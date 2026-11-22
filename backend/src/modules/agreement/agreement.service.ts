import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { depositBalance, ruleWarnings, settle } from "../../shared/utils/rental";
import { LIVE, rentFor } from "../bill-type/bill-type.service";
import { settingsOf } from "../org/org.service";
import { InvoiceService, rebuildVehicleInvoice, recalculateInvoice, vehicleCharge } from "../invoice/invoice.service";
import { vehicleLabel } from "../../shared/utils/asset";
import type { CreateAgreementInput, DepositInput, EndInput, NoticeInput, RevisionInput, UpdateAgreementInput } from "./agreement.validation";
import { audit } from "../../shared/audit";
import { enqueue } from "../notification/notification.service";
import { env } from "../../config/env";

type Tx = Prisma.TransactionClient;
const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const BANK_ONLY_ABOVE = 25000; // NBR: monthly rent above this goes through a bank

const listInclude = {
  tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
  asset: {
    select: {
      kind: true,
      unit: { select: { id: true, name: true, floor: { select: { name: true, building: { select: { id: true, name: true } } } } } },
      vehicle: { select: { id: true, regNo: true, type: true, status: true } },
    },
  },
  deposits: { select: { type: true, amount: true } },
} satisfies Prisma.AgreementInclude;

const detailInclude = {
  ...listInclude,
  tenant: true,
  revisions: { orderBy: { effectiveFrom: "asc" } },
  deposits: { orderBy: [{ date: "asc" }, { id: "asc" }] },
  notices: { where: { status: "PENDING" }, select: { id: true, noticeDate: true, moveOutDate: true, reason: true, createdAt: true } },
  invoices: {
    orderBy: { periodStart: "desc" },
    select: { id: true, month: true, year: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, carriedForward: true },
  },
} satisfies Prisma.AgreementInclude;

const ledger = (deposits: { type: any; amount: Prisma.Decimal }[]) =>
  depositBalance(deposits.map((d) => ({ type: d.type, amount: Number(d.amount) })));

/** Set the unit's status (OCCUPIED, NOTICE, back to VACANT) or the vehicle's (ON_LEASE, back to AVAILABLE) from its agreements. */
export async function syncAssetStatus(assetId: bigint, tx: Tx | typeof prisma = prisma) {
  const live = await tx.agreement.findFirst({ where: { assetId, ...LIVE }, orderBy: { startDate: "desc" }, select: { status: true } });
  const unit = await tx.flat.findUnique({ where: { assetId }, select: { id: true, status: true } });
  if (unit) {
    const status = live ? (live.status === "NOTICE" ? "NOTICE" : "OCCUPIED") : unit.status === "OCCUPIED" || unit.status === "NOTICE" ? "VACANT" : unit.status;
    if (status !== unit.status) await tx.flat.update({ where: { id: unit.id }, data: { status } });
    return;
  }
  const v = await tx.vehicle.findUnique({ where: { assetId }, select: { id: true, status: true } });
  if (!v) return;
  // OFF_ROAD belongs to maintenance
  const status = live ? (v.status === "OFF_ROAD" ? "OFF_ROAD" : "ON_LEASE") : v.status === "ON_LEASE" ? "AVAILABLE" : v.status;
  if (status !== v.status) await tx.vehicle.update({ where: { id: v.id }, data: { status } });
}

/** A maintenance request takes a free unit/vehicle off the market (on) or gives it back (off). */
export async function setBlocked(tx: Tx, assetId: bigint, on: boolean) {
  await tx.flat.updateMany({ where: { assetId, status: on ? "VACANT" : "UNDER_MAINTENANCE" }, data: { status: on ? "UNDER_MAINTENANCE" : "VACANT" } });
  await tx.vehicle.updateMany({ where: { assetId, status: on ? "AVAILABLE" : "OFF_ROAD" }, data: { status: on ? "OFF_ROAD" : "AVAILABLE" } });
}

export class AgreementService {
  private invoices = new InvoiceService();

  private async own(orgId: number, id: string) {
    const a = await prisma.agreement.findFirst({ where: { id: toNumberId(id), orgId }, include: detailInclude });
    if (!a) throw new NotFoundError("Agreement not found");
    return a;
  }

  private shape<T extends Prisma.AgreementGetPayload<{ include: typeof listInclude }>>(a: T) {
    const unit = a.asset.unit;
    return {
      ...a,
      unit: unit && { id: unit.id, name: unit.name, floorName: unit.floor.name, building: unit.floor.building },
      vehicle: a.asset.vehicle,
      depositBalance: ledger(a.deposits),
    };
  }

  async list(orgId: number, q: { status?: string; flatId?: string; vehicleId?: string; tenantId?: string; cycle?: string }) {
    const where: Prisma.AgreementWhereInput = { orgId };
    if (q.status === "LIVE") Object.assign(where, LIVE);
    else if (q.status) where.status = q.status as any;
    if (q.tenantId) where.tenantId = toNumberId(q.tenantId);
    if (q.cycle) where.cycle = q.cycle as any;
    if (q.flatId) where.asset = { unit: { id: toNumberId(q.flatId) } };
    if (q.vehicleId) where.asset = { vehicle: { id: toNumberId(q.vehicleId) } };
    const rows = await prisma.agreement.findMany({ where, include: listInclude, orderBy: [{ status: "asc" }, { startDate: "desc" }] });
    return rows.map((a) => this.shape(a));
  }

  async get(orgId: number, id: string) {
    const a = await this.own(orgId, id);
    const today = new Date();
    const currentRate = [...a.revisions].reverse().find((r) => r.effectiveFrom <= today)?.rate ?? a.rate;
    return { ...this.shape(a), currentRate };
  }

  /** The unit or vehicle a new agreement lets: its asset, name and asking rate. */
  private async target(orgId: number, input: CreateAgreementInput) {
    if (input.vehicleId) {
      const v = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, orgId } });
      if (!v) throw new NotFoundError("Vehicle not found");
      return { assetId: v.assetId, name: vehicleLabel(v), askingRate: v.rate === null ? null : Number(v.rate), vehicle: true };
    }
    const flat = await prisma.flat.findFirst({ where: { id: input.flatId, floor: { building: { orgId } } } });
    if (!flat) throw new NotFoundError("Unit not found");
    return { assetId: flat.assetId, name: flat.name, askingRate: Number(flat.rent), vehicle: false };
  }

  async create(orgId: number, input: CreateAgreementInput) {
    const flat = await this.target(orgId, input);
    if (input.tenantId && !(await prisma.tenant.count({ where: { id: input.tenantId, orgId } }))) throw new NotFoundError("Tenant not found");

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = settingsOf(org?.settings);
    const rate = input.rate ?? flat.askingRate;
    if (!rate) throw new ValidationError("Enter the rate (this vehicle has no asking rate)");
    const cycle = flat.vehicle ? input.cycle ?? "DAILY" : "MONTHLY";
    const startDate = day(input.startDate);
    const warnings = ruleWarnings({ rate, depositReceived: input.deposit, kind: flat.vehicle ? "VEHICLE" : "UNIT" });

    const agreement = await prisma.$transaction(async (tx) => {
      if (input.activate) await this.assertFree(tx, flat.assetId, startDate);
      const tenantId = input.tenantId
        ? BigInt(input.tenantId)
        : (await tx.tenant.create({ data: { ...input.tenant!, email: input.tenant!.email || null, orgId } })).id;
      const a = await tx.agreement.create({
        data: {
          orgId,
          assetId: flat.assetId,
          tenantId,
          cycle,
          rate,
          startDate,
          endDate: input.endDate ? day(input.endDate) : null,
          dueDay: input.dueDay ?? settings.dueDay,
          // drivers give about a week's notice; tenants the org's notice period
          noticeDays: input.noticeDays ?? (flat.vehicle ? 7 : settings.noticeMonths * 30),
          tdsPercent: input.tdsPercent ?? 0,
          bankOnly: cycle === "MONTHLY" && rate > BANK_ONLY_ABOVE,
          status: input.activate ? "ACTIVE" : "DRAFT",
          // the org's default extra deed clauses, editable per agreement afterwards
          terms: !flat.vehicle && settings.agreementClauses.length ? { clauses: settings.agreementClauses } : undefined,
          ...(input.deposit ? { deposits: { create: { type: "RECEIVED", amount: input.deposit, date: startDate, note: "Received at signing" } } } : {}),
        },
      });
      if (input.activate) await syncAssetStatus(flat.assetId, tx);
      await audit(tx, "agreement.create", "Agreement", a.id, { unit: flat.name, rate, status: a.status, deposit: input.deposit ?? 0 });
      return a;
    });

    if (input.activate && input.firstInvoice) {
      await this.invoices.generateForAsset(orgId, flat.assetId, startDate.getUTCMonth() + 1, startDate.getUTCFullYear()).catch((e) => {
        warnings.push(`First invoice not created: ${e.message}`);
      });
    }
    return { agreement: await this.get(orgId, String(agreement.id)), warnings };
  }

  async activate(orgId: number, id: string) {
    const a = await this.own(orgId, id);
    if (a.status !== "DRAFT") throw new ValidationError("Only a draft can be activated");
    await prisma.$transaction(async (tx) => {
      await this.assertFree(tx, a.assetId, a.startDate);
      await tx.agreement.update({ where: { id: a.id }, data: { status: "ACTIVE" } });
      await syncAssetStatus(a.assetId, tx);
      await audit(tx, "agreement.activate", "Agreement", a.id);
    });
    return this.get(orgId, id);
  }

  async addRevision(orgId: number, id: string, input: RevisionInput) {
    const a = await this.own(orgId, id);
    if (a.status === "ENDED") throw new ValidationError("The agreement has ended");
    const effectiveFrom = day(input.effectiveFrom);
    const current = Number([...a.revisions].reverse()[0]?.rate ?? a.rate);
    const warnings = ruleWarnings({
      rate: current,
      startDate: a.startDate,
      revisions: a.revisions.map((r) => ({ effectiveFrom: r.effectiveFrom, rate: Number(r.rate) })),
      newRevision: { effectiveFrom, rate: input.rate },
      kind: a.asset.kind,
    });
    await prisma.$transaction(async (tx) => {
      await tx.rateRevision.create({ data: { agreementId: a.id, effectiveFrom, rate: input.rate, reason: input.reason } });
      await tx.agreement.update({ where: { id: a.id }, data: { bankOnly: a.cycle === "MONTHLY" && Math.max(input.rate, Number(a.rate)) > BANK_ONLY_ABOVE } });
      // a daily rate changes from its own day: re-price the open vehicle invoices it touches
      if (a.asset.vehicle) {
        const open = await tx.invoice.findMany({ where: { agreementId: a.id, carriedForward: false, periodEnd: { gte: effectiveFrom } }, select: { id: true } });
        for (const inv of open) await rebuildVehicleInvoice(tx, inv.id);
      }
      await audit(tx, "agreement.revision", "Agreement", a.id, { from: current, to: input.rate, effectiveFrom: input.effectiveFrom, reason: input.reason ?? null });
    });
    return { agreement: await this.get(orgId, id), warnings };
  }

  async addDeposit(orgId: number, id: string, input: DepositInput) {
    const a = await this.own(orgId, id);
    if (input.type !== "RECEIVED" && input.amount > ledger(a.deposits)) throw new ValidationError("More than the deposit held");
    await prisma.$transaction(async (tx) => {
      await tx.depositEntry.create({ data: { agreementId: a.id, type: input.type, amount: input.amount, date: day(input.date), note: input.note } });
      await audit(tx, "agreement.deposit", "Agreement", a.id, { type: input.type, amount: input.amount, date: input.date });
    });
    const agreement = await this.get(orgId, id);
    return { agreement, warnings: ruleWarnings({ rate: Number(agreement.currentRate), depositReceived: depositsReceived(agreement.deposits), kind: agreement.asset.kind }) };
  }

  async giveNotice(orgId: number, id: string, input: NoticeInput) {
    const a = await this.own(orgId, id);
    if (a.status !== "ACTIVE") throw new ValidationError("Only an active agreement can be put on notice");
    const noticeDate = day(input.noticeDate);
    const endDate = input.endDate ? day(input.endDate) : addDays(noticeDate, a.noticeDays);
    const warnings = ruleWarnings({ rate: Number(a.rate), noticeDate, endDate, noticeDays: a.noticeDays });
    await prisma.$transaction(async (tx) => {
      await tx.agreement.update({ where: { id: a.id }, data: { status: "NOTICE", noticeDate, endDate } });
      await syncAssetStatus(a.assetId, tx);
      await audit(tx, "agreement.notice", "Agreement", a.id, { noticeDate: input.noticeDate, endDate: endDate.toISOString().slice(0, 10) });
    });
    return { agreement: await this.get(orgId, id), warnings };
  }

  /** What move-out would settle to, without saving anything. */
  async settlementPreview(orgId: number, id: string, input: Pick<EndInput, "endDate" | "deductions" | "finalInvoice">) {
    const a = await this.own(orgId, id);
    const endDate = day(input.endDate);
    const m = endDate.getUTCMonth() + 1;
    const y = endDate.getUTCFullYear();
    const lastMonthBilled = a.invoices.some((i) => i.month === m && i.year === y);
    // the final month's rent if it has not been invoiced yet (utilities are added when the invoice is made)
    const finalRent = input.finalInvoice && !lastMonthBilled ? rentFor({ ...a, endDate }, m, y)?.amount ?? 0 : 0;
    let openDues = r2(a.invoices.filter((i) => !i.carriedForward).reduce((s, i) => s + Number(i.dueAmount), 0));
    const last = a.asset.vehicle && a.invoices.find((i) => i.month === m && i.year === y && !i.carriedForward);
    if (last) {
      const full = Number(last.totalAmount);
      const cut = r2((await vehicleCharge(prisma, a, m, y))!.amount - ((await vehicleCharge(prisma, { ...a, endDate }, m, y))?.amount ?? 0));
      openDues = r2(Math.max(0, openDues - Math.min(cut, full)));
    }
    const deductions = r2(input.deductions.reduce((s, d) => s + d.amount, 0));
    const held = ledger(a.deposits);
    return { endDate: input.endDate, depositBalance: held, openDues, finalRent, deductions, lastMonthBilled, ...settle({ finalDues: r2(openDues + finalRent), depositBalance: held, deductions }) };
  }

  /**
   * Move-out: end the agreement, bill the last (pro-rated) month, then settle the deposit:
   * damage deductions first, then the deposit pays open invoices (as DEPOSIT payments), the rest is refunded.
   */
  async end(orgId: number, id: string, input: EndInput) {
    const a = await this.own(orgId, id);
    if (a.status === "ENDED") throw new ValidationError("Already ended");
    if (a.status === "DRAFT") throw new ValidationError("A draft can be deleted instead");
    const endDate = day(input.endDate);
    if (endDate < a.startDate) throw new ValidationError("End date is before the start date");

    await prisma.$transaction(async (tx) => {
      await tx.agreement.update({ where: { id: a.id }, data: { status: "ENDED", endDate } });
      await syncAssetStatus(a.assetId, tx);
    });

    const warnings: string[] = [];
    const lastOpen = a.asset.vehicle && (await prisma.invoice.findFirst({ where: { agreementId: a.id, month: endDate.getUTCMonth() + 1, year: endDate.getUTCFullYear() } }));
    if (lastOpen && !lastOpen.carriedForward) {
      // the vehicle's month invoice was made on the 1st: cut it back to the end date
      await prisma.$transaction((tx) => rebuildVehicleInvoice(tx, lastOpen.id));
    } else if (input.finalInvoice) {
      const m = endDate.getUTCMonth() + 1;
      const y = endDate.getUTCFullYear();
      if (a.invoices.some((i) => i.month === m && i.year === y)) {
        warnings.push(`The ${m}/${y} invoice already exists and was not pro-rated; edit it if the rent should be reduced.`);
      } else {
        await this.invoices.generateForAsset(orgId, a.assetId, m, y).catch((e) => warnings.push(`Final invoice not created: ${e.message}`));
      }
    }

    await prisma.$transaction(async (tx) => {
      const date = endDate;
      for (const d of input.deductions) {
        await tx.depositEntry.create({ data: { agreementId: a.id, type: "DEDUCTED_DAMAGE", amount: d.amount, date, note: d.note } });
      }
      let held = ledger(await tx.depositEntry.findMany({ where: { agreementId: a.id } }));
      if (held < 0) throw new ValidationError("Deductions are more than the deposit held");

      // deposit pays open invoices, oldest first
      const open = await tx.invoice.findMany({
        where: { agreementId: a.id, carriedForward: false, dueAmount: { gt: 0 } },
        orderBy: { periodStart: "asc" },
      });
      for (const inv of open) {
        if (held <= 0) break;
        const amount = r2(Math.min(held, Number(inv.dueAmount)));
        await tx.payment.create({ data: { invoiceId: inv.id, orgId, amount, method: "DEPOSIT", remarks: "Adjusted from deposit at move-out", date } });
        await tx.depositEntry.create({ data: { agreementId: a.id, type: "ADJUSTED", amount, date, note: `Invoice ${inv.month}/${inv.year}` } });
        await recalculateInvoice(inv.id, tx);
        held = r2(held - amount);
      }
      if (input.refund && held > 0) {
        await tx.depositEntry.create({ data: { agreementId: a.id, type: "REFUNDED", amount: held, date, note: "Refunded at move-out" } });
      }
      await audit(tx, "agreement.end", "Agreement", a.id, { endDate: input.endDate, deductions: input.deductions, refunded: input.refund && held > 0 ? held : 0 });
    });

    const agreement = await this.get(orgId, id);
    const due = r2(agreement.invoices.filter((i) => !i.carriedForward).reduce((s, i) => s + Number(i.dueAmount), 0));
    return { agreement, due, warnings };
  }

  /** Terms that can change on a running agreement: the TDS rate and the deed's extra clauses. */
  async update(orgId: number, id: string, input: UpdateAgreementInput) {
    const a = await this.own(orgId, id);
    const terms = { ...((a.terms as Record<string, unknown>) ?? {}), ...(input.clauses && { clauses: input.clauses }) };
    await prisma.$transaction(async (tx) => {
      await tx.agreement.update({ where: { id: a.id }, data: { ...(input.tdsPercent !== undefined && { tdsPercent: input.tdsPercent }), terms } });
      await audit(tx, "agreement.update", "Agreement", a.id, { tdsPercent: input.tdsPercent, clauses: input.clauses?.length });
    });
    return this.get(orgId, id);
  }

  /** Tenants' move-out requests from the portal. */
  async noticeRequests(orgId: number, status?: string) {
    return prisma.noticeRequest.findMany({
      where: { orgId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { tenant: { select: { firstName: true, lastName: true } }, agreement: { select: { asset: { select: { unit: { select: { name: true } } } } } } },
    });
  }

  /** Accept: the agreement goes on notice ending on the tenant's date; the tenant gets an SMS. */
  async acceptNotice(orgId: number, id: string, requestId: string, reviewerId: number) {
    const n = await this.pendingNotice(orgId, id, requestId);
    const result = await this.giveNotice(orgId, id, { noticeDate: n.noticeDate.toISOString().slice(0, 10), endDate: n.moveOutDate.toISOString().slice(0, 10) });
    await this.answerNotice(n, "ACCEPTED", reviewerId, null);
    return { ...result, agreement: await this.get(orgId, id) };
  }

  async declineNotice(orgId: number, id: string, requestId: string, reviewerId: number, note: string | null) {
    const n = await this.pendingNotice(orgId, id, requestId);
    await this.answerNotice(n, "DECLINED", reviewerId, note);
    return { agreement: await this.get(orgId, id), warnings: [] as string[] };
  }

  private async pendingNotice(orgId: number, id: string, requestId: string) {
    const n = await prisma.noticeRequest.findFirst({ where: { id: toNumberId(requestId), agreementId: toNumberId(id), orgId } });
    if (!n) throw new NotFoundError("Notice request not found");
    if (n.status !== "PENDING") throw new ValidationError("This request was already answered");
    return n;
  }

  private async answerNotice(n: { id: bigint; orgId: bigint; agreementId: bigint; tenantId: bigint; moveOutDate: Date }, status: "ACCEPTED" | "DECLINED", reviewerId: number, note: string | null) {
    const a = await prisma.agreement.findUniqueOrThrow({
      where: { id: n.agreementId },
      include: { org: { select: { name: true } }, tenant: { select: { phone: true, lang: true } }, asset: { select: { unit: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } } } } },
    });
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.noticeRequest.updateMany({ where: { id: n.id, status: "PENDING" }, data: { status, reviewedById: reviewerId, reviewNote: note, reviewedAt: new Date() } });
      if (!count) throw new ValidationError("This request was already answered");
      await enqueue(tx, {
        orgId: Number(n.orgId),
        template: status === "ACCEPTED" ? "NOTICE_ACCEPTED" : "NOTICE_DECLINED",
        to: a.tenant.phone,
        lang: a.tenant.lang,
        data: {
          org: a.org.name,
          unit: a.asset.unit ? `${a.asset.unit.name}, ${a.asset.unit.floor.building.name}` : "",
          amount: 0,
          moveOutDate: n.moveOutDate.toISOString().slice(0, 10),
          reason: note ?? undefined,
          link: `${env.appUrl}/portal`,
        },
      });
      await audit(tx, `notice.${status.toLowerCase()}`, "Agreement", n.agreementId, { moveOutDate: n.moveOutDate.toISOString().slice(0, 10), note });
    });
  }

  async remove(orgId: number, id: string) {
    const a = await this.own(orgId, id);
    if (a.status !== "DRAFT") throw new ValidationError("Only a draft can be deleted; end an active agreement instead");
    await prisma.agreement.delete({ where: { id: a.id } });
  }

  /** One running agreement per unit at a time (a new one may start the day after the last ends). */
  private async assertFree(tx: Tx, assetId: bigint, startDate: Date) {
    const clash = await tx.agreement.findFirst({
      where: { assetId, ...LIVE, OR: [{ endDate: null }, { endDate: { gte: startDate } }] },
      include: { tenant: { select: { firstName: true, lastName: true } } },
    });
    if (clash) throw new ConflictError(`This unit is still let to ${clash.tenant.firstName} ${clash.tenant.lastName}; end or give notice on that agreement first.`);
    // a vehicle may have rent-a-car bookings ahead (startDate is a Bangladesh day: it begins at 18:00 UTC the day before)
    const trip = await tx.booking.findFirst({
      where: { vehicle: { assetId }, status: { in: ["RESERVED", "ON_TRIP"] }, endAt: { gt: new Date(startDate.getTime() - 6 * 3_600_000) } },
      orderBy: { startAt: "asc" },
    });
    if (trip) throw new ConflictError(`This vehicle has a booking from ${new Date(trip.startAt.getTime() + 6 * 3_600_000).toISOString().slice(0, 10)}; cancel or finish it first.`);
  }
}

const depositsReceived = (deposits: { type: string; amount: Prisma.Decimal }[]) =>
  deposits.filter((d) => d.type === "RECEIVED").reduce((s, d) => s + Number(d.amount), 0);

