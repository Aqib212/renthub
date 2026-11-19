import crypto from "node:crypto";
import { Prisma, Invoice } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ConflictError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { loadBillingContext, billableFlatWhere } from "../bill-type/bill-type.service";
import type { UpdateInvoiceInput } from "./invoice.validation";

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

/** Most recent earlier invoice of a flat whose balance has not been carried yet. */
function previousOpenInvoice(client: Tx | typeof prisma, flatId: bigint, month: number, year: number) {
  return client.invoice.findFirst({
    where: {
      flatId,
      carriedForward: false,
      OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

const detailInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  payments: { orderBy: { date: "desc" } },
  tenant: { select: { firstName: true, lastName: true, phone: true, email: true } },
  owner: { select: { firstName: true, lastName: true, phone: true, email: true } },
  flat: {
    select: {
      name: true,
      flatNumber: true,
      floor: { select: { name: true, building: { select: { name: true, address: true, area: true, district: true, holdingNumber: true } } } },
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithDetail = Prisma.InvoiceGetPayload<{ include: typeof detailInclude }>;

function toDetail(inv: InvoiceWithDetail) {
  const { flat, owner, tenant, ...rest } = inv;
  return {
    ...rest,
    invoiceNo: invoiceNo(inv),
    flat: { name: flat.name, flatNumber: flat.flatNumber, floorName: flat.floor.name },
    building: flat.floor.building,
    owner: { name: `${owner.firstName} ${owner.lastName}`, phone: owner.phone, email: owner.email },
    tenant: tenant && { name: `${tenant.firstName} ${tenant.lastName}`, phone: tenant.phone, email: tenant.email },
  };
}

export class InvoiceService {
  /**
   * Build (and unless dryRun, save) invoices for the given flats of one owner.
   * Flats that already have an invoice for the month are skipped.
   */
  private async generate(ownerId: number, month: number, year: number, flatWhere: Prisma.FlatWhereInput, dryRun = false) {
    const { rows } = await loadBillingContext(ownerId, month, year, flatWhere);
    const existing = new Set(
      (await prisma.invoice.findMany({ where: { ownerId, month, year }, select: { flatId: true } })).map((i) => i.flatId)
    );

    const created: any[] = [];
    const missing: { flatName: string; billType: string }[] = [];

    for (const { flat, tenant, lines } of rows) {
      if (existing.has(flat.id)) continue;

      const rent = num(flat.rent);
      const items: Prisma.InvoiceItemCreateManyInvoiceInput[] = [{ label: "Rent", amount: rent, sortOrder: 0 }];
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
          detail: l.result.detail,
          quantity: l.result.quantity,
          rate: l.result.rate,
          amount: l.result.amount,
          sortOrder: i + 1,
        });
      });

      const prev = await previousOpenInvoice(prisma, flat.id, month, year);
      const previousDue = prev ? num(prev.dueAmount) : 0;
      const totalAmount = r2(items.reduce((s, it) => s + Number(it.amount), 0) + previousDue);

      const data = {
        flatId: flat.id,
        tenantId: tenant?.id ?? null,
        ownerId,
        month,
        year,
        rent,
        previousDue,
        totalAmount,
        dueAmount: totalAmount,
        dueDate: new Date(year, month - 1, 10),
      };

      if (dryRun) {
        created.push({ ...data, items, flatName: flat.name, tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : null });
        continue;
      }

      try {
        const inv = await prisma.$transaction(async (tx) => {
          const inv = await tx.invoice.create({ data: { ...data, items: { createMany: { data: items } } } });
          if (prev) await tx.invoice.update({ where: { id: prev.id }, data: { carriedForward: true } });
          return inv;
        });
        created.push(inv);
      } catch (e) {
        // another request created it first (unique flat+month+year) — treat as already generated
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }

    return { created, missing, total: rows.length, skipped: existing.size };
  }

  async generateForOwner(ownerId: string | number | bigint, month: number, year: number) {
    const oid = toNumberId(ownerId as any);
    const { created, missing, total } = await this.generate(oid, month, year, billableFlatWhere(oid));
    return { generated: created.length, total, missing };
  }

  async generateForFlat(ownerId: string | number | bigint, flatId: string | number | bigint, month: number, year: number, dryRun = false) {
    const oid = toNumberId(ownerId as any);
    const fid = toNumberId(flatId as any);
    const flat = await prisma.flat.findFirst({ where: { id: fid, floor: { building: { ownerId: oid } } } });
    if (!flat) throw new NotFoundError("Flat not found");

    if (await prisma.invoice.findFirst({ where: { flatId: fid, month, year }, select: { id: true } })) {
      throw new ConflictError(`Invoice already exists for ${month}/${year}`);
    }

    const { created, missing } = await this.generate(oid, month, year, { id: fid, floor: { building: { ownerId: oid } } }, dryRun);
    if (!created.length) throw new ValidationError("Flat has no active tenant and is not marked occupied");
    if (dryRun) return { ...created[0], missing };
    return { ...(await this.findById(String(oid), String(created[0].id))), missing };
  }

  async generateAll(month: number, year: number) {
    const owners = await prisma.user.findMany({ where: { role: "HOUSE_OWNER", status: "ACTIVE" }, select: { id: true } });
    const results: { ownerId: string; generated: number; total: number }[] = [];
    for (const owner of owners) {
      const { generated, total } = await this.generateForOwner(owner.id, month, year);
      results.push({ ownerId: String(owner.id), generated, total });
    }
    return results;
  }

  async findAll(ownerId: string, query: { page: number; limit: number; month?: number; year?: number; status?: string; search?: string }) {
    const where: Prisma.InvoiceWhereInput = { ownerId: toNumberId(ownerId) };
    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.status) where.status = query.status as InvoiceStatus;
    if (query.search) {
      where.OR = [
        { flat: { name: { contains: query.search } } },
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
          tenant: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: data.map(({ flat, tenant, ...inv }) => ({
        ...inv,
        invoiceNo: invoiceNo(inv),
        flatName: flat.name,
        buildingName: flat.floor.building.name,
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : null,
        tenantPhone: tenant?.phone ?? null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  private async owned(ownerId: string, id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!invoice) throw new NotFoundError("Invoice not found");
    return invoice;
  }

  async findById(ownerId: string, id: string) {
    await this.owned(ownerId, id);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: toNumberId(id) }, include: detailInclude });
    return toDetail(inv);
  }

  /** Read-only invoice for the public share link. */
  async findByShareToken(token: string) {
    const inv = await prisma.invoice.findUnique({ where: { shareToken: token }, include: detailInclude });
    if (!inv) throw new NotFoundError("Invoice not found");
    const { shareToken, ownerId, tenantId, flatId, ...detail } = toDetail(inv);
    return { ...detail, owner: { ...detail.owner, email: null } };
  }

  async share(ownerId: string, id: string) {
    const inv = await this.owned(ownerId, id);
    if (inv.shareToken) return { shareToken: inv.shareToken };
    const shareToken = crypto.randomBytes(24).toString("base64url");
    await prisma.invoice.update({ where: { id: inv.id }, data: { shareToken } });
    return { shareToken };
  }

  async update(ownerId: string, id: string, input: UpdateInvoiceInput) {
    const inv = await this.owned(ownerId, id);

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
    });

    return this.findById(ownerId, id);
  }

  async deleteInvoice(ownerId: string, id: string) {
    const inv = await this.owned(ownerId, id);
    if (await prisma.payment.count({ where: { invoiceId: inv.id } })) {
      throw new ValidationError("This invoice has payments. Delete the payments first.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id: inv.id } });
      // re-open the balance this invoice had carried forward
      if (num(inv.previousDue) > 0) {
        const prev = await tx.invoice.findFirst({
          where: { flatId: inv.flatId, carriedForward: true, OR: [{ year: { lt: inv.year } }, { year: inv.year, month: { lt: inv.month } }] },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        });
        if (prev) await tx.invoice.update({ where: { id: prev.id }, data: { carriedForward: false } });
      }
    });
  }

  async updateStatus(ownerId: string, id: string, status: string) {
    await this.owned(ownerId, id);
    return prisma.invoice.update({ where: { id: toNumberId(id) }, data: { status: status as InvoiceStatus } });
  }
}
