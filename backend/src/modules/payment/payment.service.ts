import { PaymentMethod } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { recalculateInvoice, invoiceNo } from "../invoice/invoice.service";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreatePaymentInput, UpdatePaymentInput } from "./payment.validation";

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object" && "toNumber" in (val as any)) return (val as any).toNumber();
  return Number(val);
}

export class PaymentService {
  async create(ownerId: string, input: CreatePaymentInput) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: toNumberId(input.invoiceId), ownerId: toNumberId(ownerId) },
    });
    if (!invoice) throw new NotFoundError("Invoice not found");
    if (invoice.carriedForward) {
      throw new ValidationError(`${invoiceNo(invoice)} was carried into a later invoice. Record the payment on the latest invoice.`);
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          invoiceId: toNumberId(input.invoiceId),
          ownerId: toNumberId(ownerId),
          amount: input.amount,
          method: input.method as PaymentMethod,
          transactionId: input.transactionId || null,
          collector: input.collector || null,
          remarks: input.remarks || null,
          date: input.date ? new Date(input.date) : new Date(),
        },
      });

      await recalculateInvoice(input.invoiceId, tx);

      return p;
    });

    return {
      ...payment,
      amount: toNumber(payment.amount),
    };
  }

  async findAll(ownerId: string, query: {
    page: number; limit: number; invoiceId?: number; method?: string;
    dateFrom?: string; dateTo?: string; search?: string;
  }) {
    const where: any = { ownerId: toNumberId(ownerId) };

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
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: data.map(({ invoice, ...p }) => ({
        ...p,
        amount: toNumber(p.amount),
        invoicePeriod: `${invoice.month}/${invoice.year}`,
        flatName: invoice.flat.name,
        flatNumber: invoice.flat.flatNumber,
        tenantName: invoice.tenant ? `${invoice.tenant.firstName} ${invoice.tenant.lastName}` : null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findById(ownerId: string, id: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: toNumberId(id), ownerId: toNumberId(ownerId) },
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

  async update(ownerId: string, id: string, input: UpdatePaymentInput) {
    const existing = await prisma.payment.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
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

  async remove(ownerId: string, id: string) {
    const existing = await prisma.payment.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!existing) throw new NotFoundError("Payment not found");

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: toNumberId(id) } });
      await recalculateInvoice(existing.invoiceId, tx);
    });
  }

}
