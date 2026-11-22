import { z } from "zod";
import { assertRoom } from "../org/org.service";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/utils/errors";
import { chargeFor, monthPeriod, rateFor } from "../../shared/utils/rental";
import { currentDocs } from "../../shared/notify/expiry";
import { LIVE, agreementsInMonth } from "../bill-type/bill-type.service";
import { InvoiceService, rebuildVehicleInvoice } from "../invoice/invoice.service";

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;
const BD = 6 * 3_600_000; // Bangladesh is UTC+6
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
/** Today's date in Bangladesh as YYYY-MM-DD. */
export const todayBd = () => new Date(Date.now() + BD).toISOString().slice(0, 10);

const TYPES = ["CNG", "TAXI", "CAR", "MICROBUS", "OTHER"] as const;
const opt = (n: number) => z.string().trim().max(n).nullable().optional();
export const vehicleSchema = z.object({
  type: z.enum(TYPES),
  regNo: z.string().trim().min(3).max(50),
  model: opt(100),
  year: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
  color: opt(30),
  chassisNo: opt(50),
  engineNo: opt(50),
  rate: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export const vehicleUpdateSchema = vehicleSchema.partial();
type VehicleInput = z.infer<typeof vehicleSchema>;

export const jamaQuerySchema = z.object({ date: z.string().regex(ymd).optional() });
export const dayEntrySchema = z.object({
  agreementId: z.coerce.number().int().positive(),
  date: z.string().regex(ymd),
  /** 0 = off day */
  amount: z.coerce.number().min(0),
  reason: z.string().trim().max(255).nullable().optional(),
});
export const openSchema = z.object({ agreementId: z.coerce.number().int().positive(), date: z.string().regex(ymd) });

const docSelect = { id: true, kind: true, name: true, expiresAt: true, tenantId: true, assetId: true, agreementId: true } as const;
const listInclude = {
  asset: {
    select: {
      agreements: { where: LIVE, take: 1, orderBy: { startDate: "desc" }, select: { id: true, cycle: true, rate: true, startDate: true, tenant: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      documents: { where: { expiresAt: { not: null } }, select: docSelect },
    },
  },
} satisfies Prisma.VehicleInclude;
type ListRow = Prisma.VehicleGetPayload<{ include: typeof listInclude }>;

const shape = ({ asset, ...v }: ListRow) => {
  const a = asset.agreements[0];
  const next = currentDocs(asset.documents).sort((x, y) => x.expiresAt!.getTime() - y.expiresAt!.getTime())[0] ?? null;
  return {
    ...v,
    rate: v.rate === null ? null : Number(v.rate),
    agreement: a ? { id: a.id, cycle: a.cycle, rate: Number(a.rate), startDate: a.startDate, driver: { id: a.tenant.id, name: `${a.tenant.firstName} ${a.tenant.lastName}`, phone: a.tenant.phone } } : null,
    nextExpiry: next && { id: next.id, kind: next.kind, name: next.name, expiresAt: next.expiresAt },
  };
};

export class VehicleService {
  private invoices = new InvoiceService();

  private async own(orgId: number, id: number) {
    const v = await prisma.vehicle.findFirst({ where: { id, orgId }, include: listInclude });
    if (!v) throw new NotFoundError("Vehicle not found");
    return v;
  }

  private async unique<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictError("A vehicle with this registration number already exists");
      throw e;
    }
  }

  async list(orgId: number) {
    const rows = await prisma.vehicle.findMany({ where: { orgId }, include: listInclude, orderBy: [{ type: "asc" }, { regNo: "asc" }] });
    return rows.map(shape);
  }

  async get(orgId: number, id: number) {
    const v = await this.own(orgId, id);
    const history = await prisma.agreement.findMany({
      where: { assetId: v.assetId },
      orderBy: { startDate: "desc" },
      select: { id: true, cycle: true, rate: true, status: true, startDate: true, endDate: true, tenant: { select: { id: true, firstName: true, lastName: true } } },
    });
    return { ...shape(v), agreements: history.map((a) => ({ ...a, rate: Number(a.rate), driverName: `${a.tenant.firstName} ${a.tenant.lastName}` })) };
  }

  async create(orgId: number, input: VehicleInput) {
    await assertRoom(orgId);
    const v = await this.unique(() =>
      prisma.vehicle.create({
        data: { ...input, regNo: input.regNo.toUpperCase(), org: { connect: { id: orgId } }, asset: { create: { orgId, kind: "VEHICLE" } } },
      })
    );
    return this.get(orgId, Number(v.id));
  }

  async update(orgId: number, id: number, input: Partial<VehicleInput>) {
    await this.own(orgId, id);
    await this.unique(() => prisma.vehicle.update({ where: { id }, data: { ...input, ...(input.regNo && { regNo: input.regNo.toUpperCase() }) } }));
    return this.get(orgId, id);
  }

  async remove(orgId: number, id: number) {
    const v = await this.own(orgId, id);
    if (await prisma.agreement.count({ where: { assetId: v.assetId } })) throw new ValidationError("This vehicle has agreements; it can't be deleted");
    if (await prisma.maintenanceRequest.count({ where: { assetId: v.assetId } })) throw new ValidationError("This vehicle has maintenance records; it can't be deleted");
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.delete({ where: { id: v.id } });
      await tx.asset.delete({ where: { id: v.assetId } }); // its documents cascade
    });
    return { id: v.id };
  }

  /**
   * Today's jama: one row per daily agreement running on `date`, with the day's jama, what was paid that day
   * and what the driver owes up to that day (older balances + jama so far this month − paid this month).
   */
  async jama(orgId: number, date = todayBd()) {
    const d = day(date);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    const p = monthPeriod(m, y);
    const agreements = await prisma.agreement.findMany({
      where: { orgId, cycle: "DAILY", ...agreementsInMonth(m, y), startDate: { lte: d }, OR: [{ endDate: null }, { endDate: { gte: d } }] },
      orderBy: { startDate: "asc" },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        revisions: true,
        asset: { select: { vehicle: { select: { id: true, regNo: true, type: true, status: true } } } },
        days: { where: { date: { gte: p.start, lte: p.end } }, orderBy: { date: "asc" } },
        invoices: {
          where: { carriedForward: false, periodStart: { lte: p.start } },
          select: { id: true, periodStart: true, previousDue: true, dueAmount: true, payments: { select: { amount: true, date: true } } },
        },
      },
    });

    const rows = agreements.map((a) => {
      const terms = { cycle: a.cycle, rate: Number(a.rate), startDate: a.startDate, endDate: a.endDate };
      const revs = a.revisions.map((r) => ({ effectiveFrom: r.effectiveFrom, rate: Number(r.rate) }));
      const overrides = a.days.map((x) => ({ date: x.date, amount: Number(x.amount) }));
      const entry = a.days.find((x) => x.date.getTime() === d.getTime()) ?? null;
      const inv = a.invoices.find((i) => i.periodStart?.getTime() === p.start.getTime()) ?? null;
      const older = a.invoices.filter((i) => i !== inv).reduce((s, i) => s + Number(i.dueAmount), 0);
      const paidMonth = inv ? inv.payments.reduce((s, x) => s + Number(x.amount), 0) : 0;
      // a payment dated by the form is UTC midnight, one taken "now" is any time of the Bangladesh day
      const from = d.getTime() - BD;
      const paidToday = inv ? inv.payments.filter((x) => x.date.getTime() >= from && x.date.getTime() < from + DAY).reduce((s, x) => s + Number(x.amount), 0) : 0;
      const soFar = chargeFor(terms, revs, { start: p.start, end: d }, overrides)?.amount ?? 0;
      return {
        agreementId: a.id,
        vehicle: a.asset.vehicle,
        driver: { id: a.tenant.id, name: `${a.tenant.firstName} ${a.tenant.lastName}`, phone: a.tenant.phone },
        rate: rateFor(terms, revs, d),
        jama: entry ? Number(entry.amount) : rateFor(terms, revs, d),
        entry: entry && { id: entry.id, amount: Number(entry.amount), reason: entry.reason },
        offDays: a.days.filter((x) => Number(x.amount) === 0).length,
        paidToday: r2(paidToday),
        owed: r2(older + (inv ? Number(inv.previousDue) : 0) + soFar - paidMonth),
        invoiceId: inv?.id ?? null,
      };
    });
    const sum = (k: "jama" | "paidToday" | "owed") => r2(rows.reduce((s, r) => s + r[k], 0));
    return { date, rows, totals: { expected: sum("jama"), collected: sum("paidToday"), owed: sum("owed") } };
  }

  private async dailyAgreement(orgId: number, agreementId: number) {
    const a = await prisma.agreement.findFirst({ where: { id: agreementId, orgId }, include: { asset: { select: { vehicle: { select: { regNo: true } } } } } });
    if (!a) throw new NotFoundError("Agreement not found");
    if (a.cycle !== "DAILY") throw new ValidationError("Only daily (jama) agreements have day entries");
    return a;
  }

  /** The month invoice a day's jama is collected against; made now if the cron/agreement hasn't made it yet. */
  async openInvoice(orgId: number, input: z.infer<typeof openSchema>) {
    const a = await this.dailyAgreement(orgId, input.agreementId);
    const d = day(input.date);
    const p = monthPeriod(d.getUTCMonth() + 1, d.getUTCFullYear());
    const find = () => prisma.invoice.findFirst({ where: { agreementId: a.id, periodStart: p.start }, select: { id: true } });
    let inv = await find();
    if (!inv) {
      await this.invoices.generateForAsset(orgId, a.assetId, d.getUTCMonth() + 1, d.getUTCFullYear()).catch(() => undefined);
      inv = await find();
    }
    if (!inv) throw new ValidationError("This agreement does not cover that month");
    return { invoiceId: inv.id };
  }

  /** Off day (amount 0) or a different jama for one day; the month invoice is re-priced in the same transaction. */
  async setDay(orgId: number, membershipId: number, input: z.infer<typeof dayEntrySchema>) {
    const a = await this.dailyAgreement(orgId, input.agreementId);
    const d = day(input.date);
    if (d < a.startDate || (a.endDate && d > a.endDate)) throw new ValidationError("That day is outside the agreement");
    await prisma.$transaction(async (tx) => {
      const e = await tx.dayEntry.upsert({
        where: { agreementId_date: { agreementId: a.id, date: d } },
        create: { agreementId: a.id, date: d, amount: input.amount, reason: input.reason ?? null, createdById: membershipId },
        update: { amount: input.amount, reason: input.reason ?? null, createdById: membershipId },
      });
      await this.reprice(tx, a.id, d);
      await audit(tx, "jama.day_set", "Agreement", a.id, { vehicle: a.asset.vehicle?.regNo, date: input.date, amount: input.amount, reason: input.reason ?? null, entryId: Number(e.id) });
    });
    return this.jama(orgId, input.date);
  }

  async clearDay(orgId: number, id: number) {
    const e = await prisma.dayEntry.findFirst({ where: { id, agreement: { orgId } }, include: { agreement: { include: { asset: { select: { vehicle: { select: { regNo: true } } } } } } } });
    if (!e) throw new NotFoundError("Day entry not found");
    await prisma.$transaction(async (tx) => {
      await tx.dayEntry.delete({ where: { id: e.id } });
      await this.reprice(tx, e.agreementId, e.date);
      await audit(tx, "jama.day_clear", "Agreement", e.agreementId, { vehicle: e.agreement.asset.vehicle?.regNo, date: e.date.toISOString().slice(0, 10), amount: Number(e.amount) });
    });
    return this.jama(orgId, e.date.toISOString().slice(0, 10));
  }

  private async reprice(tx: Prisma.TransactionClient, agreementId: bigint, d: Date) {
    const p = monthPeriod(d.getUTCMonth() + 1, d.getUTCFullYear());
    const inv = await tx.invoice.findFirst({ where: { agreementId, periodStart: p.start }, select: { id: true } });
    if (inv) await rebuildVehicleInvoice(tx, inv.id); // refuses a carried-forward (closed) month
  }
}
