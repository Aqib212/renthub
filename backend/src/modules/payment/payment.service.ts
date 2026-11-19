import crypto from "node:crypto";
import { PaymentMethod, Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { enqueue } from "../notification/notification.service";
import { amountInWords, formatReceiptNo } from "../../shared/notify/collect";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { recalculateInvoice, invoiceNo } from "../invoice/invoice.service";
import { toNumberId } from "../../shared/utils/helpers";
import { ruleWarnings } from "../../shared/utils/rental";
import type { CreatePaymentInput, UpdatePaymentInput } from "./payment.validation";

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object" && "toNumber" in (val as any)) return (val as any).toNumber();
  return Number(val);
}

/** Next receipt number for the organisation and year, from an atomic counter (call inside the payment transaction). */
export async function nextReceiptNo(tx: Prisma.TransactionClient, orgId: number, year: number) {
  const c = await tx.orgCounter.upsert({
    where: { orgId_key: { orgId, key: `receipt:${year}` } },
    create: { orgId, key: `receipt:${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatReceiptNo(year, c.value);
}

const receiptInclude = {
  invoice: {
    include: {
      tenant: { select: { firstName: true, lastName: true, phone: true, lang: true } },
      flat: { select: { name: true, floor: { select: { name: true, building: { select: { name: true, address: true, holdingNumber: true } } } } } },
      org: {
        select: {
          name: true,
          memberships: { where: { role: "OWNER", isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { user: { select: { phone: true, email: true } } } },
        },
      },
    },
  },
  collectedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.PaymentInclude;

function toReceipt(p: Prisma.PaymentGetPayload<{ include: typeof receiptInclude }>) {
  const inv = p.invoice;
  const ownerUser = inv.org.memberships[0]?.user;
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    receiptNo: p.receiptNo,
    date: p.date,
    amount: toNumber(p.amount),
    amountInWords: amountInWords(toNumber(p.amount)),
    method: p.method,
    transactionId: p.transactionId,
    remarks: p.remarks,
    collectorName: p.collectedBy ? `${p.collectedBy.user.firstName} ${p.collectedBy.user.lastName}` : p.collector,
    lang: inv.tenant?.lang ?? "BN",
    invoice: { invoiceNo: invoiceNo(inv), month: inv.month, year: inv.year, totalAmount: toNumber(inv.totalAmount), paidAmount: toNumber(inv.paidAmount), dueAmount: toNumber(inv.dueAmount) },
    tenant: inv.tenant && { name: `${inv.tenant.firstName} ${inv.tenant.lastName}`, phone: inv.tenant.phone },
    unit: { name: inv.flat.name, floorName: inv.flat.floor.name },
    building: inv.flat.floor.building,
    owner: { name: inv.org.name, phone: ownerUser?.phone ?? null, email: ownerUser?.email ?? null },
  };
}

export class PaymentService {
  /** Records a payment with the next receipt number and queues the receipt SMS, in one transaction. */
  async create(orgId: string, input: CreatePaymentInput, collectedById?: number) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: toNumberId(input.invoiceId), orgId: toNumberId(orgId) },
      include: {
        agreement: { select: { bankOnly: true, rate: true } },
        tenant: { select: { phone: true, lang: true } },
        flat: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } },
        org: { select: { name: true } },
      },
    });
    if (!invoice) throw new NotFoundError("Invoice not found");
    if (invoice.carriedForward) {
      throw new ValidationError(`${invoiceNo(invoice)} was carried into a later invoice. Record the payment on the latest invoice.`);
    }

    const date = input.date ? new Date(input.date) : new Date();
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          invoiceId: toNumberId(input.invoiceId),
          orgId: toNumberId(orgId),
          amount: input.amount,
          method: input.method as PaymentMethod,
          transactionId: input.transactionId || null,
          collector: input.collector || null,
          remarks: input.remarks || null,
          date,
          receiptNo: await nextReceiptNo(tx, toNumberId(orgId), date.getFullYear()),
          shareToken: crypto.randomBytes(24).toString("base64url"),
          collectedById: collectedById ?? null,
        },
      });

      await recalculateInvoice(input.invoiceId, tx);
      const after = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: { dueAmount: true } });

      // receipt SMS, sent by the outbox drainer after this transaction commits
      await enqueue(tx, {
        orgId: invoice.orgId,
        template: "RECEIPT",
        to: invoice.tenant?.phone,
        lang: invoice.tenant?.lang ?? "BN",
        paymentId: p.id,
        invoiceId: invoice.id,
        data: {
          org: invoice.org.name,
          unit: `${invoice.flat.name}, ${invoice.flat.floor.building.name}`,
          amount: Number(input.amount),
          receiptNo: p.receiptNo!,
          balance: toNumber(after.dueAmount),
          link: `${env.appUrl}/r/${p.shareToken}`,
        },
      });

      return p;
    });

    return {
      ...payment,
      amount: toNumber(payment.amount),
      // NBR: rent above ৳25,000 a month should come through a bank. Warn, never block.
      warnings: ruleWarnings({ rate: toNumber(invoice.agreement?.rate), bankOnly: invoice.agreement?.bankOnly, paymentMethod: input.method }),
    };
  }

  async findAll(orgId: string, query: {
    page: number; limit: number; invoiceId?: number; method?: string;
    dateFrom?: string; dateTo?: string; search?: string;
  }) {
    const where: any = { orgId: toNumberId(orgId) };

    if (query.invoiceId) where.invoiceId = toNumberId(query.invoiceId);
    if (query.method) where.method = query.method;
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { transactionId: { contains: query.search } },
        { remarks: { contains: query.search } },
        { collector: { contains: query.search } },
        { receiptNo: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { date: "desc" },
        include: {
          invoice: {
            include: {
              flat: { select: { name: true, flatNumber: true } },
              tenant: { select: { firstName: true, lastName: true } },
            },
          },
          collectedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: data.map(({ invoice, collectedBy, ...p }) => ({
        ...p,
        // who took the money: the staff member, else the old free-text field
        collectorName: collectedBy ? `${collectedBy.user.firstName} ${collectedBy.user.lastName}` : p.collector,
        amount: toNumber(p.amount),
        invoicePeriod: `${invoice.month}/${invoice.year}`,
        flatName: invoice.flat.name,
        flatNumber: invoice.flat.flatNumber,
        tenantName: invoice.tenant ? `${invoice.tenant.firstName} ${invoice.tenant.lastName}` : null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findById(orgId: string, id: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: toNumberId(id), orgId: toNumberId(orgId) },
        include: {
          invoice: {
            include: {
              flat: { select: { name: true, flatNumber: true, rent: true } },
              tenant: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
        },
    });
    if (!payment) throw new NotFoundError("Payment not found");
    return {
      ...payment,
      amount: toNumber(payment.amount),
    };
  }

  async update(orgId: string, id: string, input: UpdatePaymentInput) {
    const existing = await prisma.payment.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) } });
    if (!existing) throw new NotFoundError("Payment not found");

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: toNumberId(id) },
        data: {
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.method && { method: input.method as PaymentMethod }),
          ...(input.transactionId !== undefined && { transactionId: input.transactionId }),
          ...(input.collector !== undefined && { collector: input.collector }),
          ...(input.remarks !== undefined && { remarks: input.remarks }),
          ...(input.date && { date: new Date(input.date) }),
        },
      });

      if (existing.invoiceId) {
        await recalculateInvoice(existing.invoiceId, tx);
      }

      return p;
    });

    return { ...payment, amount: toNumber(payment.amount) };
  }

  /** Everything a printed or shared receipt shows. */
  async receipt(orgId: string, id: string) {
    const p = await prisma.payment.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) }, include: receiptInclude });
    if (!p) throw new NotFoundError("Payment not found");
    return toReceipt(p);
  }

  async share(orgId: string, id: string) {
    const p = await prisma.payment.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) } });
    if (!p) throw new NotFoundError("Payment not found");
    if (p.shareToken) return { shareToken: p.shareToken };
    const shareToken = crypto.randomBytes(24).toString("base64url");
    await prisma.payment.update({ where: { id: p.id }, data: { shareToken } });
    return { shareToken };
  }

  /** No login: the tenant's receipt link. */
  async findByShareToken(token: string) {
    const p = await prisma.payment.findUnique({ where: { shareToken: token }, include: receiptInclude });
    if (!p) throw new NotFoundError("Receipt not found");
    const { invoiceId, ...r } = toReceipt(p);
    return { ...r, owner: { ...r.owner, email: null } };
  }

  async remove(orgId: string, id: string) {
    const existing = await prisma.payment.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) } });
    if (!existing) throw new NotFoundError("Payment not found");

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: toNumberId(id) } });
      await recalculateInvoice(existing.invoiceId, tx);
    });
  }

}
