import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreateFloorInput, UpdateFloorInput } from "./floor.validation";

export class FloorService {
  async create(orgId: string, buildingId: string, input: CreateFloorInput) {
    const building = await prisma.building.findFirst({ where: { id: toNumberId(buildingId), orgId: toNumberId(orgId) } });
    if (!building) throw new NotFoundError("Building not found");

    return prisma.floor.create({
      data: { ...input, buildingId: toNumberId(buildingId) },
    });
  }

  async findAll(orgId: string, buildingId: string) {
    const building = await prisma.building.findFirst({ where: { id: toNumberId(buildingId), orgId: toNumberId(orgId) } });
    if (!building) throw new NotFoundError("Building not found");

    return prisma.floor.findMany({
      where: { buildingId: toNumberId(buildingId) },
      orderBy: { name: "asc" },
      include: { _count: { select: { flats: true } } },
    });
  }

  async findById(orgId: string, id: string) {
    const floor = await prisma.floor.findFirst({
      where: { id: toNumberId(id), building: { orgId: toNumberId(orgId) } },
      include: { _count: { select: { flats: true } } },
    });
    if (!floor) throw new NotFoundError("Floor not found");
    return floor;
  }

  async update(orgId: string, id: string, input: UpdateFloorInput) {
    const floor = await prisma.floor.findFirst({ where: { id: toNumberId(id), building: { orgId: toNumberId(orgId) } } });
    if (!floor) throw new NotFoundError("Floor not found");

    return prisma.floor.update({ where: { id: toNumberId(id) }, data: input });
  }

  async findAllByOwner(orgId: string) {
    return prisma.floor.findMany({
      where: { building: { orgId: toNumberId(orgId) } },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { flats: true } },
        building: { select: { name: true } },
      },
    });
  }

  async delete(orgId: string, id: string) {
    const floor = await prisma.floor.findFirst({ where: { id: toNumberId(id), building: { orgId: toNumberId(orgId) } } });
    if (!floor) throw new NotFoundError("Floor not found");

    await prisma.floor.delete({ where: { id: toNumberId(id) } });
  }
}
