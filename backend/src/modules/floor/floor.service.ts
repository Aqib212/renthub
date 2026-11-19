import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreateFloorInput, UpdateFloorInput } from "./floor.validation";

export class FloorService {
  async create(ownerId: string, buildingId: string, input: CreateFloorInput) {
    const building = await prisma.building.findFirst({ where: { id: toNumberId(buildingId), ownerId: toNumberId(ownerId) } });
    if (!building) throw new NotFoundError("Building not found");

    return prisma.floor.create({
      data: { ...input, buildingId: toNumberId(buildingId) },
    });
  }

  async findAll(ownerId: string, buildingId: string) {
    const building = await prisma.building.findFirst({ where: { id: toNumberId(buildingId), ownerId: toNumberId(ownerId) } });
    if (!building) throw new NotFoundError("Building not found");

    return prisma.floor.findMany({
      where: { buildingId: toNumberId(buildingId) },
      orderBy: { name: "asc" },
      include: { _count: { select: { flats: true } } },
    });
  }

  async findById(ownerId: string, id: string) {
    const floor = await prisma.floor.findFirst({
      where: { id: toNumberId(id), building: { ownerId: toNumberId(ownerId) } },
      include: { _count: { select: { flats: true } } },
    });
    if (!floor) throw new NotFoundError("Floor not found");
    return floor;
  }

  async update(ownerId: string, id: string, input: UpdateFloorInput) {
    const floor = await prisma.floor.findFirst({ where: { id: toNumberId(id), building: { ownerId: toNumberId(ownerId) } } });
    if (!floor) throw new NotFoundError("Floor not found");

    return prisma.floor.update({ where: { id: toNumberId(id) }, data: input });
  }

  async findAllByOwner(ownerId: string) {
    return prisma.floor.findMany({
      where: { building: { ownerId: toNumberId(ownerId) } },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { flats: true } },
        building: { select: { name: true } },
      },
    });
  }

  async delete(ownerId: string, id: string) {
    const floor = await prisma.floor.findFirst({ where: { id: toNumberId(id), building: { ownerId: toNumberId(ownerId) } } });
    if (!floor) throw new NotFoundError("Floor not found");

    await prisma.floor.delete({ where: { id: toNumberId(id) } });
  }
}
