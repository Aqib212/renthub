import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";

export const handoverSchema = z.object({
  fromMembershipId: z.coerce.number().int().positive(),
  paymentIds: z.array(z.coerce.number().int().positive()).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(255).optional(),
});
export type HandoverInput = z.infer<typeof handoverSchema>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const userName = { user: { select: { firstName: true, lastName: true } } } as const;

/** Cash a staff member collected and has not yet handed over. */
const unsettled = (orgId: number) => ({ orgId, method: "CASH" as const, handoverId: null, collectedById: { not: null } });

export class CashHandoverService {
  /** Per collector: the cash in hand and the payments it is made of. */
  async pending(orgId: number) {
    const payments = await prisma.payment.findMany({
      where: unsettled(orgId),
      orderBy: { date: "asc" },
      include: {
        collectedBy: { select: { id: true, role: true, ...userName } },
        invoice: { select: { month: true, year: true, flat: { select: { name: true } }, tenant: { select: { firstName: true, lastName: true } } } },
      },
    });
    const byCollector = new Map<string, { membershipId: number; name: string; role: string; total: number; payments: unknown[] }>();
    for (const p of payments) {
      const m = p.collectedBy!;
      const key = String(m.id);
      const row = byCollector.get(key) ?? { membershipId: Number(m.id), name: `${m.user.firstName} ${m.user.lastName}`, role: m.role, total: 0, payments: [] };
      row.total = r2(row.total + Number(p.amount));
      row.payments.push({
        id: p.id,
        receiptNo: p.receiptNo,
        date: p.date,
        amount: Number(p.amount),
        flatName: p.invoice.flat.name,
        tenantName: p.invoice.tenant ? `${p.invoice.tenant.firstName} ${p.invoice.tenant.lastName}` : null,
        period: `${p.invoice.month}/${p.invoice.year}`,
      });
      byCollector.set(key, row);
    }
    const collectors = [...byCollector.values()];
    return { collectors, total: r2(collectors.reduce((s, c) => s + c.total, 0)) };
  }

  /** The receiver (owner/manager) records cash handed over by a collector, covering the chosen payments. */
  async create(orgId: number, receiverMembershipId: number, input: HandoverInput) {
    const from = await prisma.membership.findFirst({ where: { id: input.fromMembershipId, orgId } });
    if (!from) throw new NotFoundError("Collector not found");
    if (Number(from.id) === receiverMembershipId) throw new ValidationError("You can't hand cash over to yourself");

    return prisma.$transaction(async (tx) => {
      const payments = await tx.payment.findMany({ where: { id: { in: input.paymentIds }, ...unsettled(orgId), collectedById: from.id } });
      if (payments.length !== new Set(input.paymentIds).size) {
        throw new ValidationError("Some payments are not cash collected by this person, or were already handed over");
      }
      const amount = r2(payments.reduce((s, p) => s + Number(p.amount), 0));
      const h = await tx.cashHandover.create({
        data: {
          orgId,
          fromMembershipId: from.id,
          toMembershipId: receiverMembershipId,
          amount,
          date: new Date(`${input.date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`),
          note: input.note,
        },
      });
      // the guard in the where clause makes a concurrent second handover of the same payments a no-op
      const { count } = await tx.payment.updateMany({ where: { id: { in: input.paymentIds }, handoverId: null }, data: { handoverId: h.id } });
      if (count !== payments.length) throw new ValidationError("Some payments were handed over at the same time; try again");
      return h;
    });
  }

  async list(orgId: number) {
    return prisma.cashHandover.findMany({
      where: { orgId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 100,
      include: { from: { select: userName }, to: { select: userName }, _count: { select: { payments: true } } },
    });
  }
}
