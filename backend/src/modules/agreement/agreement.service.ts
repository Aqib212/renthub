import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { depositBalance, ruleWarnings, settle } from "../../shared/utils/rental";
import { LIVE, rentFor } from "../bill-type/bill-type.service";
import { settingsOf } from "../org/org.service";
import { InvoiceService, recalculateInvoice } from "../invoice/invoice.service";
import type { CreateAgreementInput, DepositInput, EndInput, NoticeInput, RevisionInput } from "./agreement.validation";

type Tx = Prisma.TransactionClient;
const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const BANK_ONLY_ABOVE = 25000; // NBR: monthly rent above this goes through a bank

const listInclude = {
  tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
  asset: { select: { kind: true, unit: { select: { id: true, name: true, floor: { select: { name: true, building: { select: { id: true, name: true } } } } } } } },
  deposits: { select: { type: true, amount: true } },
} satisfies Prisma.AgreementInclude;

const detailInclude = {
  ...listInclude,
  tenant: true,
  revisions: { orderBy: { effectiveFrom: "asc" } },
  deposits: { orderBy: [{ date: "asc" }, { id: "asc" }] },
  invoices: {
    orderBy: { periodStart: "desc" },
    select: { id: true, month: true, year: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, carriedForward: true },
  },
} satisfies Prisma.AgreementInclude;

const ledger = (deposits: { type: any; amount: Prisma.Decimal }[]) =>
  depositBalance(deposits.map((d) => ({ type: d.type, amount: Number(d.amount) })));

/** Set the unit's status from its agreements: OCCUPIED, NOTICE, or back to VACANT. */
export async function syncUnitStatus(assetId: bigint, tx: Tx | typeof prisma = prisma) {
  const live = await tx.agreement.findFirst({ where: { assetId, ...LIVE }, orderBy: { startDate: "desc" }, select: { status: true } });
  const unit = await tx.flat.findUnique({ where: { assetId }, select: { id: true, status: true } });
  if (!unit) return;
  const status = live ? (live.status === "NOTICE" ? "NOTICE" : "OCCUPIED") : unit.status === "OCCUPIED" || unit.status === "NOTICE" ? "VACANT" : unit.status;
  if (status !== unit.status) await tx.flat.update({ where: { id: unit.id }, data: { status } });
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
      depositBalance: ledger(a.deposits),
    };
  }

  async list(orgId: number, q: { status?: string; flatId?: string; tenantId?: string }) {
    const where: Prisma.AgreementWhereInput = { orgId };
    if (q.status === "LIVE") Object.assign(where, LIVE);
    else if (q.status) where.status = q.status as any;
    if (q.tenantId) where.tenantId = toNumberId(q.tenantId);
    if (q.flatId) where.asset = { unit: { id: toNumberId(q.flatId) } };
    const rows = await prisma.agreement.findMany({ where, include: listInclude, orderBy: [{ status: "asc" }, { startDate: "desc" }] });
    return rows.map((a) => this.shape(a));
  }

  async get(orgId: number, id: string) {
    const a = await this.own(orgId, id);
    const today = new Date();
    const currentRate = [...a.revisions].reverse().find((r) => r.effectiveFrom <= today)?.rate ?? a.rate;
    return { ...this.shape(a), currentRate };
  }

  async create(orgId: number, input: CreateAgreementInput) {
    const flat = await prisma.flat.findFirst({ where: { id: input.flatId, floor: { building: { orgId } } } });
    if (!flat) throw new NotFoundError("Unit not found");
    if (input.tenantId && !(await prisma.tenant.count({ where: { id: input.tenantId, orgId } }))) throw new NotFoundError("Tenant not found");

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = settingsOf(org?.settings);
    const rate = input.rate ?? Number(flat.rent);
    const startDate = day(input.startDate);
    const warnings = ruleWarnings({ rate, depositReceived: input.deposit });

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
          rate,
          startDate,
          endDate: input.endDate ? day(input.endDate) : null,
          dueDay: input.dueDay ?? settings.dueDay,
          noticeDays: input.noticeDays ?? settings.noticeMonths * 30,
          tdsPercent: input.tdsPercent ?? 0,
          bankOnly: rate > BANK_ONLY_ABOVE,
          status: input.activate ? "ACTIVE" : "DRAFT",
          ...(input.deposit ? { deposits: { create: { type: "RECEIVED", amount: input.deposit, date: startDate, note: "Received at signing" } } } : {}),
        },
      });
      if (input.activate) await syncUnitStatus(flat.assetId, tx);
      return a;
    });

    if (input.activate && input.firstInvoice) {
      await this.invoices.generateForFlat(orgId, flat.id, startDate.getUTCMonth() + 1, startDate.getUTCFullYear()).catch((e) => {
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
      await syncUnitStatus(a.assetId, tx);
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
    });
    await prisma.$transaction([
      prisma.rateRevision.create({ data: { agreementId: a.id, effectiveFrom, rate: input.rate, reason: input.reason } }),
      prisma.agreement.update({ where: { id: a.id }, data: { bankOnly: Math.max(input.rate, Number(a.rate)) > BANK_ONLY_ABOVE } }),
    ]);
    return { agreement: await this.get(orgId, id), warnings };
  }

  async addDeposit(orgId: number, id: string, input: DepositInput) {
    const a = await this.own(orgId, id);
    if (input.type !== "RECEIVED" && input.amount > ledger(a.deposits)) throw new ValidationError("More than the deposit held");
    await prisma.depositEntry.create({ data: { agreementId: a.id, type: input.type, amount: input.amount, date: day(input.date), note: input.note } });
    const agreement = await this.get(orgId, id);
    return { agreement, warnings: ruleWarnings({ rate: Number(agreement.currentRate), depositReceived: depositsReceived(agreement.deposits) }) };
  }

  async giveNotice(orgId: number, id: string, input: NoticeInput) {
    const a = await this.own(orgId, id);
    if (a.status !== "ACTIVE") throw new ValidationError("Only an active agreement can be put on notice");
    const noticeDate = day(input.noticeDate);
    const endDate = input.endDate ? day(input.endDate) : addDays(noticeDate, a.noticeDays);
    const warnings = ruleWarnings({ rate: Number(a.rate), noticeDate, endDate, noticeDays: a.noticeDays });
    await prisma.$transaction(async (tx) => {
      await tx.agreement.update({ where: { id: a.id }, data: { status: "NOTICE", noticeDate, endDate } });
      await syncUnitStatus(a.assetId, tx);
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
    const openDues = r2(a.invoices.filter((i) => !i.carriedForward).reduce((s, i) => s + Number(i.dueAmount), 0));
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
      await syncUnitStatus(a.assetId, tx);
    });

    const warnings: string[] = [];
    if (input.finalInvoice && a.asset.unit) {
      const m = endDate.getUTCMonth() + 1;
      const y = endDate.getUTCFullYear();
      if (a.invoices.some((i) => i.month === m && i.year === y)) {
        warnings.push(`The ${m}/${y} invoice already exists and was not pro-rated; edit it if the rent should be reduced.`);
      } else {
        await this.invoices.generateForFlat(orgId, a.asset.unit.id, m, y).catch((e) => warnings.push(`Final invoice not created: ${e.message}`));
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
    });

    const agreement = await this.get(orgId, id);
    const due = r2(agreement.invoices.filter((i) => !i.carriedForward).reduce((s, i) => s + Number(i.dueAmount), 0));
    return { agreement, due, warnings };
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
  }
}

const depositsReceived = (deposits: { type: string; amount: Prisma.Decimal }[]) =>
  deposits.filter((d) => d.type === "RECEIVED").reduce((s, d) => s + Number(d.amount), 0);

