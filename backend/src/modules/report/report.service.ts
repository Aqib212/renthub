import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "../../shared/prisma";
import { LIVE } from "../bill-type/bill-type.service";
import { toNumberId } from "../../shared/utils/helpers";

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object" && "toNumber" in (val as any)) return (val as any).toNumber();
  return Number(val);
}

export class ReportService {
  async getReportData(orgId: string, type: string, query: { dateFrom?: string; dateTo?: string; month?: number; year?: number; buildingId?: number }) {
    switch (type) {
      case "income_expense": return this.incomeExpense(orgId, query);
      case "collection": return this.collection(orgId, query);
      case "rent_roll": return this.rentRoll(orgId, query);
      case "outstanding": return this.outstanding(orgId, query);
      case "expense_detail": return this.expenseDetail(orgId, query);
      default: return [];
    }
  }

  private dateFilter(query: { dateFrom?: string; dateTo?: string; year?: number; month?: number }) {
    const filter: any = {};
    if (query.dateFrom) filter.gte = new Date(query.dateFrom);
    if (query.dateTo) filter.lte = new Date(query.dateTo);
    return Object.keys(filter).length ? filter : undefined;
  }

  private async incomeExpense(orgId: string, query: any) {
    const dateFilter = this.dateFilter(query);
    const buildingFilter = query.buildingId ? { buildingId: toNumberId(query.buildingId) } : {};
    const paymentBuildingFilter = query.buildingId ? { invoice: { flat: { floor: { buildingId: toNumberId(query.buildingId) } } } } : {};

    const [incomeResult, expenseResult] = await Promise.all([
      prisma.payment.aggregate({
        where: { orgId: toNumberId(orgId), ...(dateFilter ? { date: dateFilter } : {}), ...paymentBuildingFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { orgId: toNumberId(orgId), ...(dateFilter ? { date: dateFilter } : {}), ...buildingFilter },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalIncome = toNumber(incomeResult._sum.amount);
    const totalExpense = toNumber(expenseResult._sum.amount);
    const netProfit = totalIncome - totalExpense;

    const categoryBreakdown = await prisma.expense.groupBy({
      by: ["category"],
      where: { orgId: toNumberId(orgId), ...(dateFilter ? { date: dateFilter } : {}), ...buildingFilter },
      _sum: { amount: true },
    });

    return {
      type: "income_expense",
      period: { from: query.dateFrom || null, to: query.dateTo || null },
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
        incomeCount: incomeResult._count,
        expenseCount: expenseResult._count,
      },
      expenseBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        amount: toNumber(c._sum.amount),
      })),
    };
  }

  private async collection(orgId: string, query: any) {
    const dateFilter = this.dateFilter(query);
    const buildingFilter = query.buildingId ? { flat: { floor: { buildingId: toNumberId(query.buildingId) } } } : {};
    const paymentBuildingFilter = query.buildingId ? { invoice: buildingFilter } : {};
    const whereDate = { ...(dateFilter ? { date: dateFilter } : {}), ...paymentBuildingFilter };

    const [byMethod, totalAgg, invoicesAgg, outstandingAgg] = await Promise.all([
      prisma.payment.groupBy({
        by: ["method"],
        where: { orgId: toNumberId(orgId), ...whereDate },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { orgId: toNumberId(orgId), ...whereDate },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { orgId: toNumberId(orgId), ...buildingFilter, ...(query.dateFrom ? { createdAt: { gte: new Date(query.dateFrom) } } : {}) },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { orgId: toNumberId(orgId), carriedForward: false, ...buildingFilter },
        _sum: { dueAmount: true },
      }),
    ]);

    return {
      type: "collection",
      period: { from: query.dateFrom || null, to: query.dateTo || null },
      summary: {
        totalCollected: toNumber(totalAgg._sum.amount),
        transactionCount: totalAgg._count,
        totalInvoiced: toNumber(invoicesAgg._sum.totalAmount),
        totalPaidOnInvoice: toNumber(invoicesAgg._sum.paidAmount),
        totalOutstanding: toNumber(outstandingAgg._sum.dueAmount),
      },
      byMethod: byMethod.map((m) => ({
        method: m.method,
        amount: toNumber(m._sum.amount),
        count: m._count,
      })),
    };
  }

  private async rentRoll(orgId: string, query: any) {
    const buildingFilter = query.buildingId ? { buildingId: toNumberId(query.buildingId) } : {};
    const dateFilter = query.month && query.year ? { month: query.month, year: query.year } : {};

    const flats = await prisma.flat.findMany({
      where: { floor: { building: { orgId: toNumberId(orgId), ...(query.buildingId ? { id: toNumberId(query.buildingId) } : {}) } } },
      include: {
        asset: { select: { agreements: { where: LIVE, take: 1, orderBy: { startDate: "desc" }, include: { tenant: true, revisions: { orderBy: { effectiveFrom: "desc" } } } } } },
        floor: { select: { building: { select: { name: true } } } },
        invoices: {
          where: Object.keys(dateFilter).length ? dateFilter : {},
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // contracted rent from the running agreement (latest revision that has started); asking rent when vacant
    const now = new Date();
    const rentOf = (f: (typeof flats)[number]) => {
      const a = f.asset.agreements[0];
      if (!a) return toNumber(f.rent);
      return toNumber(a.revisions.find((r) => r.effectiveFrom <= now)?.rate ?? a.rate);
    };
    return {
      type: "rent_roll",
      period: dateFilter.month ? `${dateFilter.month}/${dateFilter.year}` : null,
      totalRent: flats.reduce((s, f) => s + rentOf(f), 0),
      flats: flats.map((f) => ({
        flatName: f.name,
        flatNumber: f.flatNumber,
        buildingName: f.floor.building.name,
        status: f.status,
        tenantName: f.asset.agreements[0] ? `${f.asset.agreements[0].tenant.firstName} ${f.asset.agreements[0].tenant.lastName}` : null,
        rent: rentOf(f),
        invoiceStatus: f.invoices[0]?.status || null,
        dueAmount: f.invoices[0] ? toNumber(f.invoices[0].dueAmount) : null,
      })),
    };
  }

  private async outstanding(orgId: string, query: any) {
    // carried-forward invoices are already counted in the later invoice's previousDue
    const where: any = { orgId: toNumberId(orgId), carriedForward: false, status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } };
    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.buildingId) where.flat = { floor: { buildingId: toNumberId(query.buildingId) } };

    const [invoices, aggregate] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: {
          flat: { select: { name: true, flatNumber: true } },
          tenant: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true, dueAmount: true, paidAmount: true },
        _count: true,
      }),
    ]);

    return {
      type: "outstanding",
      summary: {
        totalInvoices: aggregate._count,
        totalAmount: toNumber(aggregate._sum.totalAmount),
        totalPaid: toNumber(aggregate._sum.paidAmount),
        totalDue: toNumber(aggregate._sum.dueAmount),
      },
      invoices: invoices.map(({ flat, tenant, ...inv }) => ({
        ...inv,
        totalAmount: toNumber(inv.totalAmount),
        paidAmount: toNumber(inv.paidAmount),
        dueAmount: toNumber(inv.dueAmount),
        flatName: flat.name,
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : null,
        tenantPhone: tenant?.phone || null,
      })),
    };
  }

  private async expenseDetail(orgId: string, query: any) {
    const dateFilter = this.dateFilter(query);
    const buildingFilter = query.buildingId ? { buildingId: toNumberId(query.buildingId) } : {};

    const [expenses, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where: { orgId: toNumberId(orgId), ...(dateFilter ? { date: dateFilter } : {}), ...buildingFilter },
        orderBy: { date: "desc" },
        include: { building: { select: { name: true } } },
      }),
      prisma.expense.aggregate({
        where: { orgId: toNumberId(orgId), ...(dateFilter ? { date: dateFilter } : {}), ...buildingFilter },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const categoryTotals: Record<string, number> = {};
    for (const e of expenses) {
      const key = e.category;
      categoryTotals[key] = (categoryTotals[key] || 0) + toNumber(e.amount);
    }

    return {
      type: "expense_detail",
      period: { from: query.dateFrom || null, to: query.dateTo || null },
      summary: {
        totalExpenses: toNumber(aggregate._sum.amount),
        expenseCount: aggregate._count,
        categoryTotals,
      },
      expenses: expenses.map(({ building, ...e }) => ({
        ...e,
        amount: toNumber(e.amount),
        buildingName: (building as any)?.name || null,
      })),
    };
  }

  // ─── PDF Generation ──────────────────────────────────────────────

  async generatePDF(orgId: string, type: string, query: any): Promise<Buffer> {
    const data: any = await this.getReportData(orgId, type, query);
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text("RentHub Report", { align: "center" });
      doc.fontSize(10).text(`Report Type: ${type.replace(/_/g, " ").toUpperCase()}`, { align: "center" });
      if (query.dateFrom || query.dateTo) {
        doc.fontSize(9).text(`Period: ${query.dateFrom || "any"} to ${query.dateTo || "any"}`, { align: "center" });
      }
      doc.moveDown(1);

      const printSummaryRow = (label: string, value: string | number) => {
        doc.fontSize(10).text(`${label}: ${value}`, { continued: false });
      };

      if (data.summary) {
        doc.fontSize(12).text("Summary", { underline: true });
        doc.moveDown(0.3);
        for (const [key, val] of Object.entries(data.summary)) {
          const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
          if (typeof val === "object") continue;
          printSummaryRow(label, String(val));
        }
        doc.moveDown(1);
      }

      const rows = this.getRowsForType(type, data);
      if (rows.length > 0) {
        doc.fontSize(12).text("Details", { underline: true });
        doc.moveDown(0.3);
        const headers = Object.keys(rows[0]);
        const colWidth = Math.max(60, Math.floor((doc.page.width - 80) / headers.length));

        doc.fontSize(8).font("Helvetica-Bold");
        let x = 40;
        for (const h of headers) {
          doc.text(h.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()), x, doc.y, { width: colWidth });
          x += colWidth;
        }
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(7);

        for (let i = 0; i < Math.min(rows.length, 50); i++) {
          const row = rows[i];
          if (doc.y > doc.page.height - 60) doc.addPage();
          x = 40;
          for (const h of headers) {
            doc.text(String(row[h] ?? ""), x, doc.y, { width: colWidth });
            x += colWidth;
          }
          doc.moveDown(0.3);
        }

        if (rows.length > 50) {
          doc.moveDown(0.5);
          doc.fontSize(8).text(`... and ${rows.length - 50} more rows.`);
        }
      }

      doc.moveDown(2);
      doc.fontSize(8).text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });
      doc.end();
    });
  }

  // ─── Excel Generation ─────────────────────────────────────────────

  async generateExcel(orgId: string, type: string, query: any): Promise<Buffer> {
    const data: any = await this.getReportData(orgId, type, query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type.replace(/_/g, " ").toUpperCase());

    sheet.addRow(["RentHub Report"]);
    sheet.addRow([`Type: ${type.replace(/_/g, " ").toUpperCase()}`]);
    if (query.dateFrom || query.dateTo) {
      sheet.addRow([`Period: ${query.dateFrom || "any"} to ${query.dateTo || "any"}`]);
    }
    sheet.addRow([]);

    if (data.summary) {
      sheet.addRow(["SUMMARY"]);
      sheet.addRow(["Metric", "Value"]);
      for (const [key, val] of Object.entries(data.summary)) {
        if (typeof val === "object") continue;
        const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        sheet.addRow([label, val]);
      }
      sheet.addRow([]);
    }

    const rows = this.getRowsForType(type, data);
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const headerRow = sheet.addRow(headers.map((h) =>
        h.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
      ));
      headerRow.font = { bold: true };

      for (const row of rows) {
        sheet.addRow(headers.map((h) => row[h] ?? ""));
      }

      sheet.getColumn(1).width = 20;
      for (let i = 1; i <= headers.length; i++) {
        sheet.getColumn(i).width = Math.max(sheet.getColumn(i).width || 15, 18);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private getRowsForType(type: string, data: any): any[] {
    switch (type) {
      case "income_expense":
        return data.expenseBreakdown || [];
      case "collection":
        return (data.byMethod || []).map((m: any) => ({ method: m.method, amount: m.amount, count: m.count }));
      case "rent_roll":
        return (data.flats || []).map((f: any) => ({
          flat: f.flatName,
          building: f.buildingName,
          status: f.status,
          tenant: f.tenantName || "Vacant",
          rent: f.rent,
          invoice_status: f.invoiceStatus || "—",
          due: f.dueAmount ?? "—",
        }));
      case "outstanding":
        return (data.invoices || []).map((inv: any) => ({
          flat: inv.flatName,
          tenant: inv.tenantName || "—",
          period: `${inv.month}/${inv.year}`,
          total: inv.totalAmount,
          paid: inv.paidAmount,
          due: inv.dueAmount,
          status: inv.status,
        }));
      case "expense_detail":
        return (data.expenses || []).map((e: any) => ({
          date: e.date ? new Date(e.date).toLocaleDateString() : "",
          category: e.category,
          description: e.description || "—",
          building: e.buildingName || "General",
          amount: e.amount,
        }));
      default:
        return [];
    }
  }
}
