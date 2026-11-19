import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import type { CreateTenantInput, UpdateTenantInput } from "./tenant.validation";

/** Keep Flat.status in step with whether it has an active tenant. */
async function syncFlatStatus(flatId: bigint | number) {
  const active = await prisma.tenant.count({ where: { flatId, status: "ACTIVE" } });
  if (active) {
    await prisma.flat.update({ where: { id: flatId }, data: { status: "OCCUPIED" } });
  } else {
    await prisma.flat.updateMany({ where: { id: flatId, status: "OCCUPIED" }, data: { status: "VACANT" } });
  }
}

export class TenantService {
  async create(ownerId: string, flatId: string, input: CreateTenantInput, files?: { photo?: string; agreementDoc?: string }) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(flatId), floor: { building: { ownerId: toNumberId(ownerId) } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");

    const tenant = await prisma.tenant.create({
      data: {
        ...input,
        moveInDate: input.moveInDate ? new Date(input.moveInDate) : undefined,
        moveOutDate: input.moveOutDate ? new Date(input.moveOutDate) : undefined,
        photo: files?.photo || null,
        agreementDoc: files?.agreementDoc || null,
        flatId: toNumberId(flatId),
        ownerId: toNumberId(ownerId),
      },
    });
    await syncFlatStatus(tenant.flatId);
    return tenant;
  }

  async findAll(ownerId: string, flatId: string) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(flatId), floor: { building: { ownerId: toNumberId(ownerId) } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");

    return prisma.tenant.findMany({
      where: { flatId: toNumberId(flatId) },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAllByOwner(ownerId: string) {
    return prisma.tenant.findMany({
      where: { ownerId: toNumberId(ownerId) },
      orderBy: { createdAt: "desc" },
      include: {
        flat: { select: { name: true, floorId: true, floor: { select: { name: true, buildingId: true, building: { select: { name: true } } } } } },
      },
    });
  }

  async findById(ownerId: string, id: string) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: toNumberId(id), ownerId: toNumberId(ownerId) },
      include: {
        flat: { select: { name: true, floorId: true, floor: { select: { name: true, buildingId: true, building: { select: { name: true } } } } } },
      },
    });
    if (!tenant) throw new NotFoundError("Tenant not found");
    return tenant;
  }

  async update(ownerId: string, id: string, input: UpdateTenantInput, files?: { photo?: string; agreementDoc?: string }) {
    const tenant = await prisma.tenant.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!tenant) throw new NotFoundError("Tenant not found");

    const data: any = { ...input };
    if (input.moveInDate) data.moveInDate = new Date(input.moveInDate);
    if (input.moveOutDate) data.moveOutDate = new Date(input.moveOutDate);
    if (files?.photo) data.photo = files.photo;
    if (files?.agreementDoc) data.agreementDoc = files.agreementDoc;

    const updated = await prisma.tenant.update({ where: { id: toNumberId(id) }, data });
    await syncFlatStatus(updated.flatId);
    return updated;
  }

  async delete(ownerId: string, id: string) {
    const tenant = await prisma.tenant.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!tenant) throw new NotFoundError("Tenant not found");

    await prisma.tenant.delete({ where: { id: toNumberId(id) } });
    await syncFlatStatus(tenant.flatId);
  }
}
