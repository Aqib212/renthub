import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreateBuildingInput, UpdateBuildingInput } from "./building.validation";

export class BuildingService {
  async create(orgId: string, input: CreateBuildingInput) {
    return prisma.building.create({
      data: { ...input, orgId: toNumberId(orgId) },
    });
  }

  async findAll(orgId: string, query: { page: number; limit: number; search?: string }) {
    const where: any = { orgId: toNumberId(orgId) };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { holdingNumber: { contains: query.search } },
        { address: { contains: query.search } },
        { area: { contains: query.search } },
        { district: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.building.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { floors: true } } },
      }),
      prisma.building.count({ where }),
    ]);

    return {
      data: data.map(({ _count, ...b }) => ({ ...b, totalFloors: _count.floors })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(orgId: string, id: string) {
    const building = await prisma.building.findFirst({
      where: { id: toNumberId(id), orgId: toNumberId(orgId) },
      include: {
        _count: { select: { floors: true } },
        floors: {
          include: {
            _count: { select: { flats: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!building) throw new NotFoundError("Building not found");

    const { _count, ...rest } = building;
    return { ...rest, totalFloors: _count.floors };
  }

  async update(orgId: string, id: string, input: UpdateBuildingInput) {
    const existing = await prisma.building.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) } });
    if (!existing) throw new NotFoundError("Building not found");

    return prisma.building.update({
      where: { id: toNumberId(id) },
      data: input,
    });
  }

  async delete(orgId: string, id: string) {
    const existing = await prisma.building.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) } });
    if (!existing) throw new NotFoundError("Building not found");

    await prisma.building.delete({ where: { id: toNumberId(id) } });
  }
}
