import { prisma } from "../../shared/prisma";
import { toNumberId } from "../../shared/utils/helpers";
import { invoiceNo } from "../invoice/invoice.service";

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object" && "toNumber" in (val as any)) {
    return (val as any).toNumber();
  }
  return Number(val);
}

export class DashboardService {
  async getOverview(ownerId: string) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [
      totalBuildings,
      totalFlats,
      occupiedFlats,
      currentMonthStats,
      yearlyIncome,
      totalExpenses,
      latestPayments,
      pendingInvoices,
    ] = await Promise.all([
      prisma.building.count({ where: { ownerId: toNumberId(ownerId) } }),
      prisma.flat.count({ where: { floor: { building: { ownerId: toNumberId(ownerId) } } } }),
      prisma.flat.count({
        where: { floor: { building: { ownerId: toNumberId(ownerId) } }, status: "OCCUPIED" },
      }),
      prisma.invoice.aggregate({
        where: { ownerId: toNumberId(ownerId), month: currentMonth, year: currentYear },
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          ownerId: toNumberId(ownerId),
          date: {
            gte: new Date(currentYear, 0, 1),
            lt: new Date(currentYear + 1, 0, 1),
          },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          ownerId: toNumberId(ownerId),
          date: { gte: new Date(currentYear, 0, 1), lt: new Date(currentYear + 1, 0, 1) },
        },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { ownerId: toNumberId(ownerId) },
        orderBy: { date: "desc" },
        take: 5,
        include: { invoice: { select: { flat: { select: { name: true } } } } },
      }),
      prisma.invoice.count({
        where: { ownerId: toNumberId(ownerId), carriedForward: false, status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] } },
      }),
    ]);

    const vacantFlats = totalFlats - occupiedFlats;

    // Monthly income from payments (last 6 months)
    const monthlyIncomeRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT MONTH(p.date) as mn, SUM(p.amount) as tot
       FROM payments p
       WHERE p.ownerId = ? AND p.date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
       GROUP BY MONTH(p.date) ORDER BY mn ASC`,
      toNumberId(ownerId)
    );

    // Monthly collection data (current year)
    const collectionRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT i.month as mn, SUM(i.paidAmount) as col, SUM(i.dueAmount) as due
       FROM invoices i
       WHERE i.ownerId = ? AND i.year = ?
       GROUP BY i.month ORDER BY i.month ASC`,
      toNumberId(ownerId),
      currentYear
    );

    // Outstanding by flat
    const outstandingRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT f.name as fn, SUM(i.dueAmount) as due
       FROM invoices i
       JOIN flats f ON f.id = i.flatId
       JOIN floors fl ON fl.id = f.floorId
       JOIN buildings b ON b.id = fl.buildingId
       WHERE i.ownerId = ? AND i.status != 'PAID' AND i.carriedForward = false
       GROUP BY f.name ORDER BY due DESC`,
      toNumberId(ownerId)
    );

    // Invoice status breakdown
    const invoicesByStatus = await prisma.invoice.groupBy({
      by: ["status"],
      where: { ownerId: toNumberId(ownerId), carriedForward: false },
      _count: true,
      _sum: { dueAmount: true },
    });

    const totalDue = invoicesByStatus.reduce(
      (acc, curr) => (curr.status !== "PAID" ? acc + toNumber(curr._sum.dueAmount) : acc),
      0
    );

    const collectionStats = await prisma.invoice.aggregate({
      where: { ownerId: toNumberId(ownerId) },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const collectionRate =
      toNumber(collectionStats._sum.totalAmount) > 0
        ? (toNumber(collectionStats._sum.paidAmount) / toNumber(collectionStats._sum.totalAmount)) * 100
        : 0;

    // This month's billed amount per bill type (rent included)
    const billTypeRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT it.label as label, SUM(it.amount) as amt
       FROM invoice_items it
       JOIN invoices i ON i.id = it.invoiceId
       WHERE i.ownerId = ? AND i.month = ? AND i.year = ?
       GROUP BY it.label ORDER BY amt DESC`,
      toNumberId(ownerId),
      currentMonth,
      currentYear
    );

    const unpaid = await prisma.invoice.findMany({
      where: { ownerId: toNumberId(ownerId), carriedForward: false, status: { not: "PAID" } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 8,
      include: {
        flat: { select: { name: true } },
        tenant: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    const yearlyIncomeVal = toNumber(yearlyIncome._sum.amount);
    const totalExpensesVal = toNumber(totalExpenses._sum.amount);

    return {
      stats: {
        totalBuildings,
        totalFlats,
        occupiedFlats,
        vacantFlats,
        vacancyRate: totalFlats > 0 ? Math.round((vacantFlats / totalFlats) * 100) : 0,
        currentMonthCollection: toNumber(currentMonthStats._sum.paidAmount),
        currentMonthTotal: toNumber(currentMonthStats._sum.totalAmount),
        currentMonthDue: toNumber(currentMonthStats._sum.dueAmount),
        totalDue: Math.round(totalDue * 100) / 100,
        yearlyIncome: yearlyIncomeVal,
        totalExpenses: totalExpensesVal,
        profit: Math.round((yearlyIncomeVal - totalExpensesVal) * 100) / 100,
        collectionRate: Math.round(collectionRate * 100) / 100,
        pendingInvoices,
        totalInvoices: currentMonthStats._count,
      },
      charts: {
        monthlyIncome: monthlyIncomeRows.map((r: any) => ({
          month: r.mn,
          amount: toNumber(r.tot),
        })),
        monthlyCollection: this.buildMonthlyCollection(collectionRows),
        outstandingRent: outstandingRows.map((r: any) => ({
          flatName: r.fn,
          dueAmount: toNumber(r.due),
        })),
      },
      billedByType: billTypeRows.map((r: any) => ({ label: r.label, amount: toNumber(r.amt) })),
      unpaidInvoices: unpaid.map((i) => ({
        id: i.id,
        invoiceNo: invoiceNo(i),
        month: i.month,
        year: i.year,
        flatName: i.flat.name,
        tenantName: i.tenant ? `${i.tenant.firstName} ${i.tenant.lastName}` : null,
        tenantPhone: i.tenant?.phone ?? null,
        dueAmount: toNumber(i.dueAmount),
        status: i.status,
      })),
      recentPayments: latestPayments.map((p) => ({
        id: p.id,
        amount: toNumber(p.amount),
        method: p.method,
        date: p.date,
        flatName: p.invoice.flat.name,
        transactionId: p.transactionId,
      })),
    };
  }

  private buildMonthlyCollection(rows: any[]) {
    const result = [];
    for (let m = 1; m <= 12; m++) {
      const existing = rows.find((r: any) => r.mn === m);
      result.push({
        month: m,
        collected: existing ? toNumber(existing.col) : 0,
        due: existing ? toNumber(existing.due) : 0,
      });
    }
    return result;
  }
}
