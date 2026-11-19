import { ExpenseCategory } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreateExpenseInput, UpdateExpenseInput } from "./expense.validation";

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object" && "toNumber" in (val as any)) return (val as any).toNumber();
  return Number(val);
}

export class ExpenseService {
  async create(ownerId: string, input: CreateExpenseInput) {
    if (input.buildingId) {
      const building = await prisma.building.findFirst({
        where: { id: toNumberId(input.buildingId), ownerId: toNumberId(ownerId) },
      });
      if (!building) throw new NotFoundError("Building not found");
    }

    const expense = await prisma.expense.create({
      data: {
        ownerId: toNumberId(ownerId),
        buildingId: input.buildingId ? toNumberId(input.buildingId) : null,
        category: input.category as ExpenseCategory,
        amount: input.amount,
        description: input.description || null,
        date: input.date ? new Date(input.date) : new Date(),
      },
      include: {
        building: { select: { name: true } },
      },
    });

    return {
      ...expense,
      amount: toNumber(expense.amount),
      buildingName: (expense as any).building?.name || null,
    };
  }

  async findAll(ownerId: string, query: {
    page: number; limit: number; category?: string; buildingId?: number;
    dateFrom?: string; dateTo?: string; search?: string;
  }) {
    const where: any = { ownerId: toNumberId(ownerId) };

    if (query.category) where.category = query.category;
    if (query.buildingId) where.buildingId = toNumberId(query.buildingId);

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    if (query.search) {
      where.description = { contains: query.search };
    }

    const [data, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { date: "desc" },
        include: {
          building: { select: { name: true } },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      data: data.map(({ building, ...e }) => ({
        ...e,
        amount: toNumber(e.amount),
        buildingName: (building as any)?.name || null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findById(ownerId: string, id: string) {
    const expense = await prisma.expense.findFirst({
      where: { id: toNumberId(id), ownerId: toNumberId(ownerId) },
      include: { building: { select: { name: true, id: true } } },
    });
    if (!expense) throw new NotFoundError("Expense not found");

    return {
      ...expense,
      amount: toNumber(expense.amount),
      buildingName: (expense as any).building?.name || null,
    };
  }

  async update(ownerId: string, id: string, input: UpdateExpenseInput) {
    const existing = await prisma.expense.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!existing) throw new NotFoundError("Expense not found");

    if (input.buildingId) {
      const building = await prisma.building.findFirst({
        where: { id: toNumberId(input.buildingId), ownerId: toNumberId(ownerId) },
      });
      if (!building) throw new NotFoundError("Building not found");
    }

    const expense = await prisma.expense.update({
      where: { id: toNumberId(id) },
      data: {
        ...(input.category && { category: input.category as ExpenseCategory }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.date && { date: new Date(input.date) }),
        ...(input.buildingId !== undefined && { buildingId: input.buildingId ? toNumberId(input.buildingId) : null }),
      },
      include: { building: { select: { name: true } } },
    });

    return {
      ...expense,
      amount: toNumber(expense.amount),
      buildingName: (expense as any).building?.name || null,
    };
  }

  async remove(ownerId: string, id: string) {
    const existing = await prisma.expense.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!existing) throw new NotFoundError("Expense not found");
    await prisma.expense.delete({ where: { id: toNumberId(id) } });
  }
}
