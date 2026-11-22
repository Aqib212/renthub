import { Prisma } from "@prisma/client";
import { assertRoom } from "../org/org.service";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { LIVE } from "../bill-type/bill-type.service";
import type { CreateFlatInput, UpdateFlatInput } from "./flat.validation";

/** The agreement holding the unit now, with its tenant (for lists and the units board). */
const unitInclude = {
  asset: {
    select: {
      id: true,
      agreements: {
        where: LIVE,
        take: 1,
        orderBy: { startDate: "desc" },
        select: { id: true, status: true, rate: true, startDate: true, endDate: true, tenant: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      },
      _count: { select: { agreements: true } },
    },
  },
} satisfies Prisma.FlatInclude;

type UnitRow = Prisma.FlatGetPayload<{ include: typeof unitInclude }>;

/** Flattens the asset relation: `currentAgreement` plus the old `_count.tenants` the screens use. */
const toUnit = <T extends UnitRow>({ asset, ...flat }: T) => ({
  ...flat,
  currentAgreement: asset.agreements[0] ?? null,
  _count: { tenants: asset._count.agreements },
});

export class FlatService {
  async create(orgId: string, floorId: string, input: CreateFlatInput) {
    const floor = await prisma.floor.findFirst({
      where: { id: toNumberId(floorId), building: { orgId: toNumberId(orgId) } },
    });
    if (!floor) throw new NotFoundError("Floor not found");
    await assertRoom(toNumberId(orgId));
    if (input.status === "OCCUPIED" || input.status === "NOTICE") input.status = "VACANT"; // set by agreements

    // every unit is an Asset, so agreements and invoices can point at it
    return prisma.flat.create({
      data: {
        ...input,
        area: input.area ?? undefined,
        advance: input.advance ?? undefined,
        securityDeposit: input.securityDeposit ?? undefined,
        floor: { connect: { id: floor.id } },
        asset: { create: { orgId: toNumberId(orgId), kind: "UNIT" } },
      } as Prisma.FlatCreateInput,
    });
  }

  async findAll(orgId: string, floorId: string) {
    const floor = await prisma.floor.findFirst({
      where: { id: toNumberId(floorId), building: { orgId: toNumberId(orgId) } },
    });
    if (!floor) throw new NotFoundError("Floor not found");

    const flats = await prisma.flat.findMany({ where: { floorId: toNumberId(floorId) }, orderBy: { name: "asc" }, include: unitInclude });
    return flats.map(toUnit);
  }

  async findById(orgId: string, id: string) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(id), floor: { building: { orgId: toNumberId(orgId) } } },
      include: { ...unitInclude, floor: { select: { name: true, building: { select: { name: true } } } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");
    return toUnit(flat);
  }

  async update(orgId: string, id: string, input: UpdateFlatInput) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(id), floor: { building: { orgId: toNumberId(orgId) } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");
    if (input.status && input.status !== flat.status) {
      if (input.status === "OCCUPIED" || input.status === "NOTICE") {
        throw new ValidationError("Occupied and On notice come from agreements: create an agreement or give notice instead.");
      }
      if (await prisma.agreement.count({ where: { assetId: flat.assetId, ...LIVE } })) {
        throw new ValidationError("This unit has a running agreement; end it before changing the status.");
      }
    }

    return prisma.flat.update({ where: { id: toNumberId(id) }, data: input });
  }

  async findAllByOwner(orgId: string) {
    const flats = await prisma.flat.findMany({
      where: { floor: { building: { orgId: toNumberId(orgId) } } },
      orderBy: { name: "asc" },
      include: { ...unitInclude, floor: { select: { name: true, buildingId: true, building: { select: { name: true } } } } },
    });
    return flats.map(toUnit);
  }

  async delete(orgId: string, id: string) {
    const flat = await prisma.flat.findFirst({
      where: { id: toNumberId(id), floor: { building: { orgId: toNumberId(orgId) } } },
      include: { asset: { select: { _count: { select: { agreements: true, invoices: true } } } } },
    });
    if (!flat) throw new NotFoundError("Flat not found");
    if (flat.asset._count.agreements || flat.asset._count.invoices) {
      throw new ValidationError("This unit has agreements or invoices; it can't be deleted.");
    }
    await prisma.$transaction([
      prisma.flat.delete({ where: { id: flat.id } }),
      prisma.asset.delete({ where: { id: flat.assetId } }),
    ]);
  }
}
