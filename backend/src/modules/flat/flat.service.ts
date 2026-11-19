import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreateFlatInput, UpdateFlatInput } from "./flat.validation";

export class FlatService {
  async create(ownerId: string, floorId: string, input: CreateFlatInput) {
    const floor = await prisma.floor.findFirst({
      where: { id: toNumberId(floorId), building: { ownerId: toNumberId(ownerId) } },
    });
    if (!floor) throw new NotFoundError("Floor not found");

    return prisma.flat.create({
      data: {
        ...input,
        area: input.area ?? undefined,
        advance: input.advance ?? undefined,
        securityDeposit: input.securityDeposit ?? undefined,
        floorId: toNumberId(floorId),
      },
    });
  }

  async findAll(ownerId: string, floorId: string) {
    const floor = await prisma.floor.findFirst({
      where: { id: toNumberId(floorId), building: { ownerId: toNumberId(ownerId) } },
    });
    if (!floor) throw new NotFoundError("Floor not found");

    return prisma.flat.findMany({
      where: { floorId: toNumberId(floorId) },
      orderBy: { name: "asc" },
      include: { _count: { select: { tenants: true } } },
    });
  }

  async findById(ownerId: string, id: string) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(id), floor: { building: { ownerId: toNumberId(ownerId) } } },
      include: {
        _count: { select: { tenants: true } },
        floor: { select: { name: true, building: { select: { name: true } } } },
      },
    });
    if (!flat) throw new NotFoundError("Flat not found");
    return flat;
  }

  async update(ownerId: string, id: string, input: UpdateFlatInput) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(id), floor: { building: { ownerId: toNumberId(ownerId) } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");

    return prisma.flat.update({ where: { id: toNumberId(id) }, data: input });
  }

  async findAllByOwner(ownerId: string) {
    return prisma.flat.findMany({
      where: { floor: { building: { ownerId: toNumberId(ownerId) } } },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { tenants: true } },
        floor: { select: { name: true, buildingId: true, building: { select: { name: true } } } },
      },
    });
  }

  async delete(ownerId: string, id: string) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(id), floor: { building: { ownerId: toNumberId(ownerId) } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");

    await prisma.flat.delete({ where: { id: toNumberId(id) } });
  }
}
