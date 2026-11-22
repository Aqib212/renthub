import crypto from "node:crypto";
import { Prisma, Invoice } from "@prisma/client";
import { audit } from "../../shared/audit";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ConflictError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { loadBillingContext, billableFlatWhere, agreementsInMonth, agreementInclude, rentFor, type AgreementRow } from "../bill-type/bill-type.service";
import type { UpdateInvoiceInput } from "./invoice.validation";
import { monthPeriod } from "../../shared/utils/rental";
import { assetVehicle, unitName } from "../../shared/utils/asset";
import { lateFeeFor } from "../../shared/utils/lateFee";
import { settingsOf } from "../org/org.service";

type Tx = Prisma.TransactionClient;
type InvoiceStatus = "PENDING" | "PAID" | "PARTIALLY_PAID" | "OVERDUE";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export const invoiceNo = (inv: { id: bigint | number; month: number; year: number }) =>
  `INV-${inv.year}${String(inv.month).padStart(2, "0")}-${String(inv.id).padStart(4, "0")}`;

function statusFor(total: number, paid: number, dueDate: Date | null): InvoiceStatus {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  if (dueDate && new Date() > dueDate) return "OVERDUE";
  return "PENDING";
}

/** Re-derive paid / due / status from payments. Shared with the payment module. */
export async function recalculateInvoice(invoiceId: bigint | number | string, tx: Tx | typeof prisma = prisma) {
  const id = toNumberId(invoiceId as any);
  const [agg, invoice] = await Promise.all([
    tx.payment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } }),
    tx.invoice.findUnique({ where: { id } }),
  ]);
  if (!invoice) return;
  const total = num(invoice.totalAmount);
  const paid = num(agg._sum.amount);
  await tx.invoice.update({
    where: { id },
    data: {
      paidAmount: Math.min(paid, total),
      dueAmount: Math.max(0, r2(total - paid)),
      status: statusFor(total, paid, invoice.dueDate),
    },
  });
}

/** Most recent earlier invoice of the same agreement whose balance has not been carried yet. */
function previousOpenInvoice(client: Tx | typeof prisma, agreementId: bigint, periodStart: Date) {
  return client.invoice.findFirst({
    where: { agreementId, carriedForward: false, periodStart: { lt: periodStart } },
    orderBy: { periodStart: "desc" },
  });
}

/** A vehicle agreement's charge for one month, with that month's off days / jama overrides. */
export async function vehicleCharge(client: Tx | typeof prisma, a: AgreementRow, month: number, year: number) {
  const p = monthPeriod(month, year);
  const days = a.cycle === "DAILY" ? await client.dayEntry.findMany({ where: { agreementId: a.id, date: { gte: p.start, lte: p.end } } }) : [];
  return rentFor(a, month, year, days.map((d) => ({ date: d.date, amount: Number(d.amount) })));
}

type Charge = NonNullable<ReturnType<typeof rentFor>>;
const tk = (n: number) => `৳${n.toLocaleString("en-IN")}`;
/** The main line of a vehicle invoice: "Jama" (DAILY) or "Rent" (MONTHLY). */
const vehicleItem = (cycle: string, c: Charge) =>
  cycle === "DAILY"
    ? { label: "Jama", detail: `${c.days} days × ${tk(c.rate)}${c.offDays ? ` · ${c.offDays} off day${c.offDays > 1 ? "s" : ""}` : ""}`, quantity: null, rate: null, amount: c.amount, sortOrder: 0 }
    : { label: "Rent", detail: c.prorated ? `${c.days} of ${c.monthDays} days` : null, quantity: c.prorated ? c.days : null, rate: c.prorated ? r2(c.rate / c.monthDays) : null, amount: c.amount, sortOrder: 0 };

/**
 * Re-derive a vehicle invoice's Jama/Rent line after a day entry or the end date changed.
 * A carried-forward month is closed: its balance already sits in the next invoice.
 */
export async function rebuildVehicleInvoice(tx: Tx, invoiceId: bigint) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { agreement: { include: agreementInclude }, items: true } });
  if (!inv.agreement) return;
  if (inv.carriedForward) throw new ValidationError(`${inv.month}/${inv.year} is closed: its balance was carried to the next invoice`);
  const c = await vehicleCharge(tx, inv.agreement, inv.month, inv.year);
  const amount = c?.amount ?? 0;
  const main = inv.items.find((i) => !i.billTypeId && (i.label === "Jama" || i.label === "Rent"));
  const line = c ? vehicleItem(inv.agreement.cycle, c) : { label: main?.label ?? "Jama", detail: null, quantity: null, rate: null, amount: 0, sortOrder: 0 };
  if (main) await tx.invoiceItem.update({ where: { id: main.id }, data: line });
  else await tx.invoiceItem.create({ data: { ...line, invoiceId: inv.id } });
  const others = inv.items.filter((i) => i.id !== main?.id).reduce((s, i) => s + num(i.amount), 0);
  await tx.invoice.update({
    where: { id: inv.id },
    data: { rent: amount, totalAmount: Math.max(0, r2(others + amount + num(inv.previousDue) - num(inv.discount) + num(inv.fine))) },
  });
  await recalculateInvoice(inv.id, tx);
}

/**
 * Nightly: add each org's late fee (Settings) once to monthly rent invoices that are past due + grace days.
 * The fee is the invoice's `fine`; an invoice that already has a fine (charged, or set by hand) is left alone.
 * ponytail: a fee waived by setting fine to 0 is charged again the next night; add a waived flag if owners hit it.
 */
export async function applyLateFees(today = new Date()) {
  const orgs = await prisma.organization.findMany({ where: { suspendedAt: null }, select: { id: true, settings: true } });
  let charged = 0;
  for (const org of orgs) {
    const s = settingsOf(org.settings).lateFee;
    if (!s.enabled || s.amount <= 0) continue;
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: org.id, carriedForward: false, fine: 0, dueAmount: { gt: 0 },
        dueDate: { lte: new Date(today.getTime() - s.afterDays * 86_400_000) },
        agreement: { cycle: "MONTHLY" },
      },
      select: { id: true, dueDate: true, dueAmount: true, fine: true, rent: true, carriedForward: true, agreement: { select: { cycle: true } } },
    });
    for (const inv of invoices) {
      const fee = lateFeeFor({ ...inv, dueAmount: num(inv.dueAmount), fine: num(inv.fine), rent: num(inv.rent), cycle: inv.agreement?.cycle ?? null }, s, today);
      if (!fee) continue;
      await prisma.$transaction(async (tx) => {
        // fine: 0 again here, so a concurrent run cannot charge twice
        const { count } = await tx.invoice.updateMany({ where: { id: inv.id, fine: 0 }, data: { fine: fee, totalAmount: { increment: fee } } });
        if (count) await recalculateInvoice(inv.id, tx);
        charged += count;
      });
    }
  }
  return { charged };
}

const detailInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  payments: { orderBy: { date: "desc" } },
  tenant: { select: { firstName: true, lastName: true, phone: true, email: true, lang: true } },
  // the landlord shown on the invoice: the workspace name plus its owner's contact
  org: {
    select: {
      name: true,
      memberships: { where: { role: "OWNER", isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { user: { select: { phone: true, email: true } } } },
    },
  },
  flat: {
    select: {
      name: true,
      flatNumber: true,
      floor: { select: { name: true, building: { select: { name: true, address: true, area: true, district: true, holdingNumber: true } } } },
    },
  },
  asset: assetVehicle,
} satisfies Prisma.InvoiceInclude;

type InvoiceWithDetail = Prisma.InvoiceGetPayload<{ include: typeof detailInclude }>;

function toDetail(inv: InvoiceWithDetail) {
  const { flat, asset, org, tenant, ...rest } = inv;
  const ownerUser = org.memberships[0]?.user;
  return {
    ...rest,
    invoiceNo: invoiceNo(inv),
    // vehicle invoices: the reg no stands in for the unit and there is no building
    flat: { name: unitName({ flat, asset }), flatNumber: flat?.flatNumber ?? null, floorName: flat?.floor.name ?? null },
    building: flat?.floor.building ?? null,
    vehicle: asset?.vehicle ?? null,
    owner: { name: org.name, phone: ownerUser?.phone ?? null, email: ownerUser?.email ?? null },
    tenant: tenant && { name: `${tenant.firstName} ${tenant.lastName}`, phone: tenant.phone, email: tenant.email, lang: tenant.lang },
  };
}

export class InvoiceService {
  /**
   * Build (and unless dryRun, save) one invoice per agreement covering the month, for the given flats.
   * Agreements already invoiced for the month are skipped.
   */
  private async generate(orgId: number, month: number, year: number, flatWhere: Prisma.FlatWhereInput, dryRun = false) {
    const { rows } = await loadBillingContext(orgId, month, year, flatWhere);
    const period = monthPeriod(month, year);
    const existing = new Set(
      (await prisma.invoice.findMany({ where: { orgId, periodStart: period.start, agreementId: { not: null } }, select: { agreementId: true } }))
        .map((i) => String(i.agreementId))
    );

    const created: any[] = [];
    const missing: { flatName: string; billType: string }[] = [];
    let total = 0;

    for (const { flat, agreements, lines } of rows) {
      for (const [idx, { agreement: a, rent }] of agreements.entries()) {
        if (!rent) continue;
        total++;
        if (existing.has(String(a.id))) continue;

        const items: Prisma.InvoiceItemCreateManyInvoiceInput[] = [{
          label: "Rent",
          detail: rent.prorated ? `${rent.days} of ${rent.monthDays} days` : null,
          quantity: rent.prorated ? rent.days : null,
          rate: rent.prorated ? r2(rent.rate / rent.monthDays) : null,
          amount: rent.amount,
          sortOrder: 0,
        }];
        // utilities belong to whoever holds the unit at month end (the last agreement)
        if (idx === agreements.length - 1) {
          lines.forEach((l, i) => {
            if (!l.applies) return;
            if (!l.result) {
              // metered/manual types without an entry for this month are left off but reported
              missing.push({ flatName: flat.name, billType: l.billType.name });
              return;
            }
            items.push({
              billTypeId: l.billType.id,
              label: l.billType.name,
              // a typed amount with a note (e.g. a split building bill) shows the note instead of "Entered amount"
              detail: (l.entry?.amount != null && l.entry.note) || l.result.detail,
              quantity: l.result.quantity,
              rate: l.result.rate,
              amount: l.result.amount,
              sortOrder: i + 1,
            });
          });
        }

        const prev = await previousOpenInvoice(prisma, a.id, period.start);
        const previousDue = prev ? num(prev.dueAmount) : 0;
        const totalAmount = r2(items.reduce((s, it) => s + Number(it.amount), 0) + previousDue);

        const data = {
          flatId: flat.id,
          tenantId: a.tenantId,
          agreementId: a.id,
          assetId: a.assetId,
          orgId,
          month,
          year,
          periodStart: period.start,
          periodEnd: period.end,
          rent: rent.amount,
          previousDue,
          totalAmount,
          dueAmount: totalAmount,
          dueDate: new Date(year, month - 1, a.dueDay),
        };

        if (dryRun) {
          created.push({ ...data, items, flatName: flat.name, tenantName: `${a.tenant.firstName} ${a.tenant.lastName}` });
          continue;
        }

        const inv = await this.save(data, items, prev);
        if (inv) created.push(inv);
      }
    }

    return { created, missing, total, skipped: existing.size };
  }

  /** Create the invoice and mark the one it carries forward, atomically. null when another request made it first. */
  private async save(data: Prisma.InvoiceUncheckedCreateInput, items: Prisma.InvoiceItemCreateManyInvoiceInput[], prev: Invoice | null) {
    try {
      return await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({ data: { ...data, items: { createMany: { data: items } } } });
        if (prev) await tx.invoice.update({ where: { id: prev.id }, data: { carriedForward: true } });
        return inv;
      });
    } catch (e) {
      // unique agreement + period: treat as already generated
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
      throw e;
    }
  }

  /** One invoice per vehicle agreement covering the month: the Jama (DAILY) or Rent (MONTHLY) line, no utilities. */
  private async generateVehicles(orgId: number, month: number, year: number, where: Prisma.AgreementWhereInput = {}) {
    const period = monthPeriod(month, year);
    const agreements = await prisma.agreement.findMany({
      where: { orgId, ...agreementsInMonth(month, year), asset: { kind: "VEHICLE" }, ...where },
      include: { ...agreementInclude, invoices: { where: { periodStart: period.start }, select: { id: true } } },
    });
    const created: Invoice[] = [];
    let total = 0;
    for (const a of agreements) {
      const c = await vehicleCharge(prisma, a, month, year);
      if (!c) continue;
      total++;
      if (a.invoices.length) continue;
      const prev = await previousOpenInvoice(prisma, a.id, period.start);
      const previousDue = prev ? num(prev.dueAmount) : 0;
      const totalAmount = r2(c.amount + previousDue);
      const inv = await this.save({
        flatId: null,
        tenantId: a.tenantId,
        agreementId: a.id,
        assetId: a.assetId,
        orgId,
        month,
        year,
        periodStart: period.start,
        periodEnd: period.end,
        rent: c.amount,
        previousDue,
        totalAmount,
        dueAmount: totalAmount,
        // jama is collected day by day; the month's balance is due at month end
        dueDate: a.cycle === "DAILY" ? period.end : new Date(year, month - 1, a.dueDay),
      }, [vehicleItem(a.cycle, c)], prev);
      if (inv) created.push(inv);
    }
    return { created, total };
  }

  /** Invoice one asset (unit or vehicle) for a month; used by agreement create and move-out. */
  async generateForAsset(orgId: number, assetId: bigint, month: number, year: number) {
    const unit = await prisma.flat.findUnique({ where: { assetId }, select: { id: true } });
    if (unit) return this.generateForFlat(orgId, unit.id, month, year);
    const { created, total } = await this.generateVehicles(orgId, month, year, { assetId });
    if (!total) throw new ValidationError("This vehicle has no agreement covering that month");
    if (!created.length) throw new ConflictError(`Invoice already exists for ${month}/${year}`);
    return this.findById(String(orgId), String(created[0].id));
  }

  async generateForOrg(orgId: string | number | bigint, month: number, year: number) {
    const oid = toNumberId(orgId as any);
    const { created, missing, total } = await this.generate(oid, month, year, billableFlatWhere(oid, month, year));
    const v = await this.generateVehicles(oid, month, year);
    const generated = created.length + v.created.length;
    if (generated) await audit(prisma, "invoice.generate", "Invoice", null, { month, year, generated, total: total + v.total });
    return { generated, total: total + v.total, missing };
  }

  async generateForFlat(orgId: string | number | bigint, flatId: string | number | bigint, month: number, year: number, dryRun = false) {
    const oid = toNumberId(orgId as any);
    const fid = toNumberId(flatId as any);
    const flat = await prisma.flat.findFirst({ where: { id: fid, floor: { building: { orgId: oid } } } });
    if (!flat) throw new NotFoundError("Flat not found");

    const { created, missing, total } = await this.generate(oid, month, year, { id: fid, floor: { building: { orgId: oid } } }, dryRun);
    if (!total) throw new ValidationError("This unit has no agreement covering that month");
    if (!created.length) throw new ConflictError(`Invoice already exists for ${month}/${year}`);
    if (dryRun) return { ...created[0], missing };
    return { ...(await this.findById(String(oid), String(created[0].id))), missing };
  }

  async generateAll(month: number, year: number) {
    const orgs = await prisma.organization.findMany({ where: { suspendedAt: null }, select: { id: true } });
    const results: { orgId: string; generated: number; total: number }[] = [];
    for (const org of orgs) {
      const { generated, total } = await this.generateForOrg(org.id, month, year);
      results.push({ orgId: String(org.id), generated, total });
    }
    return results;
  }

  async findAll(orgId: string, query: { page: number; limit: number; month?: number; year?: number; status?: string; search?: string }) {
    const where: Prisma.InvoiceWhereInput = { orgId: toNumberId(orgId) };
    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.status) where.status = query.status as InvoiceStatus;
    if (query.search) {
      where.OR = [
        { flat: { name: { contains: query.search } } },
        { asset: { vehicle: { regNo: { contains: query.search } } } },
        { tenant: { firstName: { contains: query.search } } },
        { tenant: { lastName: { contains: query.search } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
        include: {
          flat: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } },
          asset: assetVehicle,
          tenant: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: data.map(({ flat, asset, tenant, ...inv }) => ({
        ...inv,
        invoiceNo: invoiceNo(inv),
        flatName: unitName({ flat, asset }),
        buildingName: flat?.floor.building.name ?? "",
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : null,
        tenantPhone: tenant?.phone ?? null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  private async owned(orgId: string, id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) } });
    if (!invoice) throw new NotFoundError("Invoice not found");
    return invoice;
  }

  async findById(orgId: string, id: string) {
    await this.owned(orgId, id);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: toNumberId(id) }, include: detailInclude });
    return toDetail(inv);
  }

  /** Read-only invoice for the public share link. */
  async findByShareToken(token: string) {
    const inv = await prisma.invoice.findUnique({ where: { shareToken: token }, include: detailInclude });
    if (!inv) throw new NotFoundError("Invoice not found");
    const { shareToken, orgId, tenantId, flatId, ...detail } = toDetail(inv);
    const org = await prisma.organization.findUnique({ where: { id: inv.orgId }, select: { gateway: true } });
    const canPayOnline = !!(org?.gateway as { storeId?: string } | null)?.storeId && !inv.carriedForward && num(inv.dueAmount) >= 10;
    return { ...detail, owner: { ...detail.owner, email: null }, canPayOnline };
  }

  async share(orgId: string, id: string) {
    const inv = await this.owned(orgId, id);
    if (inv.shareToken) return { shareToken: inv.shareToken };
    const shareToken = crypto.randomBytes(24).toString("base64url");
    await prisma.invoice.update({ where: { id: inv.id }, data: { shareToken } });
    return { shareToken };
  }

  async update(orgId: string, id: string, input: UpdateInvoiceInput) {
    const inv = await this.owned(orgId, id);

    await prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
        await tx.invoiceItem.createMany({
          data: input.items.map((it, i) => ({
            invoiceId: inv.id,
            billTypeId: it.billTypeId ?? null,
            label: it.label,
            detail: it.detail ?? null,
            amount: it.amount,
            sortOrder: i,
          })),
        });
      }
      const itemsAgg = await tx.invoiceItem.aggregate({ where: { invoiceId: inv.id }, _sum: { amount: true } });
      const discount = input.discount ?? num(inv.discount);
      const fine = input.fine ?? num(inv.fine);
      const rentItem = input.items?.find((it) => it.label === "Rent" && !it.billTypeId);
      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          discount,
          fine,
          ...(rentItem && { rent: rentItem.amount }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
          totalAmount: Math.max(0, r2(num(itemsAgg._sum.amount) + num(inv.previousDue) - discount + fine)),
        },
      });
      await recalculateInvoice(inv.id, tx);
      await audit(tx, "invoice.update", "Invoice", inv.id, { period: `${inv.month}/${inv.year}`, before: { total: num(inv.totalAmount), discount: num(inv.discount), fine: num(inv.fine) }, changes: input as any });
    });

    return this.findById(orgId, id);
  }

  async deleteInvoice(orgId: string, id: string) {
    const inv = await this.owned(orgId, id);
    if (await prisma.payment.count({ where: { invoiceId: inv.id } })) {
      throw new ValidationError("This invoice has payments. Delete the payments first.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id: inv.id } });
      await audit(tx, "invoice.delete", "Invoice", inv.id, { period: `${inv.month}/${inv.year}`, total: num(inv.totalAmount), flatId: Number(inv.flatId) });
      // re-open the balance this invoice had carried forward
      if (num(inv.previousDue) > 0) {
        const prev = await tx.invoice.findFirst({
          where: inv.agreementId && inv.periodStart
            ? { agreementId: inv.agreementId, carriedForward: true, periodStart: { lt: inv.periodStart } }
            : { flatId: inv.flatId, carriedForward: true, OR: [{ year: { lt: inv.year } }, { year: inv.year, month: { lt: inv.month } }] },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        });
        if (prev) await tx.invoice.update({ where: { id: prev.id }, data: { carriedForward: false } });
      }
    });
  }

  async updateStatus(orgId: string, id: string, status: string) {
    await this.owned(orgId, id);
    return prisma.invoice.update({ where: { id: toNumberId(id) }, data: { status: status as InvoiceStatus } });
  }
}
