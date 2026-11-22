import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "../../shared/prisma";
import { LIVE } from "../bill-type/bill-type.service";
import { toNumberId } from "../../shared/utils/helpers";
import { daysBetween, depositBalance, fiscalYearRange, monthPeriod, utcDate, vacantDays } from "../../shared/utils/rental";
import { assetVehicle, unitName } from "../../shared/utils/asset";

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object" && "toNumber" in (val as any)) return (val as any).toNumber();
  return Number(val);
}

export class ReportService {
  async getReportData(orgId: string, type: string, query: { dateFrom?: string; dateTo?: string; month?: number; year?: number; buildingId?: number; fiscalYear?: number }) {
    switch (type) {
      case "income_expense": return this.incomeExpense(orgId, query);
      case "collection": return this.collection(orgId, query);
      case "rent_roll": return this.rentRoll(orgId, query);
      case "outstanding": return this.outstanding(orgId, query);
      case "expense_detail": return this.expenseDetail(orgId, query);
      case "deposit_liability": return this.depositLiability(orgId, query);
      case "vacancy_loss": return this.vacancyLoss(orgId, query);
      case "collection_by_collector": return this.collectionByCollector(orgId, query);
      case "tax_statement": return this.taxStatement(orgId, query);
      case "vehicle_statement": return this.vehicleStatement(orgId, query);
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
          asset: assetVehicle,
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
      invoices: invoices.map(({ flat, asset, tenant, ...inv }) => ({
        ...inv,
        totalAmount: toNumber(inv.totalAmount),
        paidAmount: toNumber(inv.paidAmount),
        dueAmount: toNumber(inv.dueAmount),
        flatName: unitName({ flat, asset }),
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

  // ─── Phase 4 reports ─────────────────────────────────────────────

  /** Deposits held per agreement (money owed back to tenants), from the deposit ledger. */
  private async depositLiability(orgId: string, query: any) {
    const agreements = await prisma.agreement.findMany({
      where: {
        orgId: toNumberId(orgId),
        status: { not: "DRAFT" },
        deposits: { some: {} },
        ...(query.buildingId ? { asset: { unit: { floor: { buildingId: toNumberId(query.buildingId) } } } } : {}),
      },
      include: {
        deposits: { select: { type: true, amount: true } },
        tenant: { select: { firstName: true, lastName: true } },
        asset: { select: { unit: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } } } },
      },
      orderBy: { startDate: "asc" },
    });
    const sumOf = (a: (typeof agreements)[number], t: string) => a.deposits.filter((d) => d.type === t).reduce((s, d) => s + toNumber(d.amount), 0);
    const rows = agreements
      .map((a) => ({
        unit: a.asset.unit?.name ?? "—",
        building: a.asset.unit?.floor.building.name ?? "—",
        tenant: `${a.tenant.firstName} ${a.tenant.lastName}`,
        status: a.status,
        received: sumOf(a, "RECEIVED"),
        adjusted: sumOf(a, "ADJUSTED"),
        deducted: sumOf(a, "DEDUCTED_DAMAGE"),
        refunded: sumOf(a, "REFUNDED"),
        held: depositBalance(a.deposits.map((d) => ({ type: d.type, amount: toNumber(d.amount) }))),
      }))
      .filter((r) => r.held !== 0 || r.status !== "ENDED");
    return {
      type: "deposit_liability",
      summary: { totalHeld: rows.reduce((s, r) => s + r.held, 0), agreements: rows.length },
      rows,
    };
  }

  /** Rent lost to empty units: vacant days in the range × asking rent per day of that month. */
  private async vacancyLoss(orgId: string, query: any) {
    const today = new Date();
    const from = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00Z`) : utcDate(today.getUTCFullYear(), 1, 1);
    const to = query.dateTo ? new Date(`${query.dateTo}T00:00:00Z`) : utcDate(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
    const flats = await prisma.flat.findMany({
      where: { floor: { building: { orgId: toNumberId(orgId), ...(query.buildingId ? { id: toNumberId(query.buildingId) } : {}) } } },
      include: {
        floor: { select: { building: { select: { name: true } } } },
        asset: { select: { agreements: { where: { status: { in: ["ACTIVE", "NOTICE", "ENDED"] } }, select: { startDate: true, endDate: true } } } },
      },
      orderBy: { name: "asc" },
    });
    const rows = flats.map((f) => {
      // a unit added mid-range only counts from the day it was added
      const created = utcDate(f.createdAt.getUTCFullYear(), f.createdAt.getUTCMonth() + 1, f.createdAt.getUTCDate());
      let days = 0;
      let loss = 0;
      for (let m = utcDate(from.getUTCFullYear(), from.getUTCMonth() + 1, 1); m <= to; m = utcDate(m.getUTCFullYear(), m.getUTCMonth() + 2, 1)) {
        const month = monthPeriod(m.getUTCMonth() + 1, m.getUTCFullYear());
        const start = new Date(Math.max(month.start.getTime(), from.getTime(), created.getTime()));
        const end = new Date(Math.min(month.end.getTime(), to.getTime()));
        if (start > end) continue;
        const v = vacantDays({ start, end }, f.asset.agreements);
        days += v;
        loss += (toNumber(f.rent) * v) / daysBetween(month.start, month.end);
      }
      return { unit: f.name, building: f.floor.building.name, status: f.status, askingRent: toNumber(f.rent), vacantDays: days, loss: Math.round(loss) };
    }).filter((r) => r.vacantDays > 0);
    return {
      type: "vacancy_loss",
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      summary: { totalLoss: rows.reduce((s, r) => s + r.loss, 0), vacantUnitDays: rows.reduce((s, r) => s + r.vacantDays, 0), unitsAffected: rows.length },
      rows,
    };
  }

  /** Per vehicle over a date range (default: this month): jama/rent billed, collected, owed now, off days, repairs, net. */
  private async vehicleStatement(orgId: string, query: any) {
    const oid = toNumberId(orgId);
    const today = new Date();
    const from = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00Z`) : utcDate(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
    const to = query.dateTo ? new Date(`${query.dateTo}T00:00:00Z`) : utcDate(today.getUTCFullYear(), today.getUTCMonth() + 2, 0);
    const toEnd = new Date(to.getTime() + 86_400_000);
    const vehicles = await prisma.vehicle.findMany({
      where: { orgId: oid },
      orderBy: { regNo: "asc" },
      include: {
        asset: {
          select: {
            invoices: { select: { totalAmount: true, previousDue: true, dueAmount: true, carriedForward: true, periodStart: true, payments: { where: { date: { gte: from, lt: toEnd }, method: { not: "DEPOSIT" } }, select: { amount: true } } } },
            agreements: { select: { days: { where: { date: { gte: from, lte: to }, amount: 0 }, select: { id: true } } } },
            maintenance: { where: { cost: { not: null }, resolvedAt: { gte: from, lt: toEnd } }, select: { cost: true } },
          },
        },
        bookings: { where: { status: "DONE", startAt: { lt: toEnd }, endAt: { gte: from } }, select: { id: true } },
      },
    });
    const round = (n: number) => Math.round(n * 100) / 100;
    const monthStart = utcDate(from.getUTCFullYear(), from.getUTCMonth() + 1, 1);
    const rows = vehicles.map((v) => {
      const inRange = v.asset.invoices.filter((i) => i.periodStart && i.periodStart >= monthStart && i.periodStart <= to);
      const collected = round(v.asset.invoices.reduce((s, i) => s + i.payments.reduce((t, p) => t + toNumber(p.amount), 0), 0));
      const repairs = round(v.asset.maintenance.reduce((s, m) => s + toNumber(m.cost), 0));
      return {
        vehicle: `${v.regNo} (${v.type})`,
        // this period's charges (jama/rent, trip bills with their extras), not balances carried in
        billed: round(inRange.reduce((s, i) => s + toNumber(i.totalAmount) - toNumber(i.previousDue), 0)),
        collected,
        owedNow: round(v.asset.invoices.filter((i) => !i.carriedForward).reduce((s, i) => s + toNumber(i.dueAmount), 0)),
        offDays: v.asset.agreements.reduce((s, a) => s + a.days.length, 0),
        trips: v.bookings.length,
        repairs,
        net: round(collected - repairs),
      };
    });
    const total = (k: "billed" | "collected" | "owedNow" | "repairs" | "net") => round(rows.reduce((s, r) => s + r[k], 0));
    return {
      type: "vehicle_statement",
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      summary: { vehicles: rows.length, billed: total("billed"), collected: total("collected"), owedNow: total("owedNow"), repairs: total("repairs"), net: total("net") },
      rows,
    };
  }

  /** Money taken by each staff member, by method, and the cash they still hold. */
  private async collectionByCollector(orgId: string, query: any) {
    const dateFilter = this.dateFilter(query);
    const oid = toNumberId(orgId);
    const buildingFilter = query.buildingId ? { invoice: { flat: { floor: { buildingId: toNumberId(query.buildingId) } } } } : {};
    const [groups, inHand, members] = await Promise.all([
      prisma.payment.groupBy({
        by: ["collectedById", "method"],
        where: { orgId: oid, method: { not: "DEPOSIT" }, ...(dateFilter ? { date: dateFilter } : {}), ...buildingFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ["collectedById"],
        where: { orgId: oid, method: "CASH", handoverId: null, collectedById: { not: null } },
        _sum: { amount: true },
      }),
      prisma.membership.findMany({ where: { orgId: oid }, select: { id: true, role: true, user: { select: { firstName: true, lastName: true } } } }),
    ]);
    const nameOf = new Map(members.map((m) => [String(m.id), `${m.user.firstName} ${m.user.lastName} (${m.role.toLowerCase()})`]));
    const hand = new Map(inHand.map((h) => [String(h.collectedById), toNumber(h._sum.amount)]));
    const rows = groups
      .map((g) => ({
        collector: g.collectedById ? nameOf.get(String(g.collectedById)) ?? "Former member" : "Not recorded (before staff tracking)",
        method: g.method,
        payments: g._count,
        amount: toNumber(g._sum.amount),
        cashInHand: g.method === "CASH" && g.collectedById ? hand.get(String(g.collectedById)) ?? 0 : null,
      }))
      .sort((a, b) => a.collector.localeCompare(b.collector) || b.amount - a.amount);
    return {
      type: "collection_by_collector",
      period: { from: query.dateFrom || null, to: query.dateTo || null },
      summary: {
        totalCollected: rows.reduce((s, r) => s + r.amount, 0),
        payments: rows.reduce((s, r) => s + r.payments, 0),
        cashWithStaff: [...hand.values()].reduce((s, v) => s + v, 0),
      },
      rows,
    };
  }

  /**
   * Yearly rent-income statement per building for the owner's tax return (income year 1 July – 30 June).
   * Facts only (billed, received by channel, TDS, expenses); it is not tax advice.
   */
  private async taxStatement(orgId: string, query: any) {
    const now = new Date();
    const fy = query.fiscalYear ?? (now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1);
    const { start, end } = fiscalYearRange(fy);
    const endExclusive = new Date(end.getTime() + 86_400_000);
    const oid = toNumberId(orgId);
    const inBuilding = query.buildingId ? { flat: { floor: { buildingId: toNumberId(query.buildingId) } } } : {};

    const [invoices, payments, expenses, buildings] = await Promise.all([
      prisma.invoice.findMany({
        where: { orgId: oid, ...inBuilding, OR: [{ year: fy, month: { gte: 7 } }, { year: fy + 1, month: { lte: 6 } }] },
        select: { rent: true, flat: { select: { floor: { select: { buildingId: true } } } } },
      }),
      prisma.payment.findMany({
        where: { orgId: oid, date: { gte: start, lt: endExclusive }, ...(query.buildingId ? { invoice: inBuilding } : {}) },
        select: { amount: true, method: true, invoice: { select: { agreement: { select: { bankOnly: true } }, flat: { select: { floor: { select: { buildingId: true } } } } } } },
      }),
      prisma.expense.findMany({
        where: { orgId: oid, date: { gte: start, lt: endExclusive }, ...(query.buildingId ? { buildingId: toNumberId(query.buildingId) } : {}) },
        select: { amount: true, category: true, buildingId: true },
      }),
      prisma.building.findMany({ where: { orgId: oid }, select: { id: true, name: true, holdingNumber: true } }),
    ]);

    const BANK = ["BANK", "CHEQUE"];
    const MOBILE = ["BKASH", "NAGAD", "ROCKET"];
    const blank = () => ({ rentBilled: 0, bank: 0, mobile: 0, cash: 0, tds: 0, deposit: 0, cashOnBankOnly: 0, expenses: 0, holdingTax: 0 });
    const byBuilding = new Map<string, ReturnType<typeof blank>>();
    const row = (id: unknown) => {
      const k = id == null ? "none" : String(id);
      if (!byBuilding.has(k)) byBuilding.set(k, blank());
      return byBuilding.get(k)!;
    };
    for (const i of invoices) row(i.flat?.floor.buildingId).rentBilled += toNumber(i.rent);
    for (const p of payments) {
      const r = row(p.invoice.flat?.floor.buildingId);
      const a = toNumber(p.amount);
      if (BANK.includes(p.method)) r.bank += a;
      else if (MOBILE.includes(p.method)) r.mobile += a;
      else if (p.method === "CASH") {
        r.cash += a;
        if (p.invoice.agreement?.bankOnly) r.cashOnBankOnly += a;
      } else if (p.method === "TDS") r.tds += a;
      else if (p.method === "DEPOSIT") r.deposit += a;
    }
    for (const e of expenses) {
      const r = row(e.buildingId);
      if (e.category === "HOLDING_TAX") r.holdingTax += toNumber(e.amount);
      else r.expenses += toNumber(e.amount);
    }

    const names = new Map(buildings.map((b) => [String(b.id), b]));
    const round = (n: number) => Math.round(n * 100) / 100;
    const rows = [...byBuilding.entries()].map(([k, r]) => ({
      building: names.get(k)?.name ?? "Vehicles and general (no building)",
      holding: names.get(k)?.holdingNumber ?? "",
      rentBilled: round(r.rentBilled),
      receivedBank: round(r.bank),
      receivedMobile: round(r.mobile),
      receivedCash: round(r.cash),
      tdsWithheld: round(r.tds),
      depositAdjusted: round(r.deposit),
      totalReceived: round(r.bank + r.mobile + r.cash + r.tds + r.deposit),
      cashOnBankOnly: round(r.cashOnBankOnly),
      expenses: round(r.expenses),
      holdingTax: round(r.holdingTax),
    }));
    const total = (k: keyof (typeof rows)[number]) => round(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
    return {
      type: "tax_statement",
      period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
      summary: {
        incomeYear: `${fy}-${String((fy + 1) % 100).padStart(2, "0")}`,
        rentBilled: total("rentBilled"),
        totalReceived: total("totalReceived"),
        throughBank: round(total("receivedBank") + total("receivedMobile")),
        receivedCash: total("receivedCash"),
        tdsWithheld: total("tdsWithheld"),
        cashOnBankOnly: total("cashOnBankOnly"),
        expenses: total("expenses"),
        holdingTax: total("holdingTax"),
        note: "For your accountant. Figures from RentHub records; not tax advice.",
      },
      rows,
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
      const from = data.period?.from ?? query.dateFrom;
      const to = data.period?.to ?? query.dateTo;
      if (from || to) doc.fontSize(9).text(`Period: ${from || "any"} to ${to || "any"}`, { align: "center" });
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
    const from = data.period?.from ?? query.dateFrom;
    const to = data.period?.to ?? query.dateTo;
    if (from || to) sheet.addRow([`Period: ${from || "any"} to ${to || "any"}`]);
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
      case "deposit_liability":
      case "vacancy_loss":
      case "collection_by_collector":
      case "tax_statement":
      case "vehicle_statement":
        return data.rows || [];
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
