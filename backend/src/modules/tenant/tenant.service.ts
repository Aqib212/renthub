import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { AgreementService, syncAssetStatus } from "../agreement/agreement.service";
import type { CreateTenantInput, UpdateTenantInput } from "./tenant.validation";
import { actorStore } from "../../shared/audit";
import { saveDocument } from "../document/document.service";

/**
 * A tenant is now a party: a person or company. Where they live, from when, and whether
 * they still do comes from their agreements. Responses keep the old fields (flatId, flat,
 * moveInDate, moveOutDate, status, agreementDoc), derived from the latest agreement, so
 * the existing screens keep working.
 */
const stayInclude = {
  agreements: {
    orderBy: { startDate: "desc" },
    take: 1,
    include: {
      asset: { select: { unit: { select: { id: true, name: true, floorId: true, floor: { select: { name: true, buildingId: true, building: { select: { name: true } } } } } } } },
    },
  },
} satisfies Prisma.TenantInclude;

type TenantWithStay = Prisma.TenantGetPayload<{ include: typeof stayInclude }>;

function withStay({ agreements, ...t }: TenantWithStay) {
  const a = agreements[0];
  const unit = a?.asset.unit;
  return {
    ...t,
    flatId: unit?.id ?? null,
    flat: unit ? { name: unit.name, floorId: unit.floorId, floor: unit.floor } : null,
    moveInDate: a?.startDate ?? null,
    moveOutDate: a?.endDate ?? null,
    agreementDoc: a?.documentPath ?? null,
    status: a && (a.status === "ACTIVE" || a.status === "NOTICE") ? "ACTIVE" : "FORMER",
    agreementId: a?.id ?? null,
    agreementStatus: a?.status ?? null,
  };
}

const ymd = (s?: string) => (s ? s.slice(0, 10) : new Date().toISOString().slice(0, 10));
const personal = <T extends UpdateTenantInput>({ moveInDate, moveOutDate, status, deposit, ...rest }: T) => rest;

type TenantFiles = { photo?: Express.Multer.File; agreementDoc?: Express.Multer.File };

/** Uploaded photo / agreement file also go to the document vault. */
async function toVault(orgId: number, files: TenantFiles | undefined, tenantId: bigint, agreementId?: bigint | number | null, assetId?: bigint | null) {
  const membershipId = actorStore.getStore()?.membershipId;
  if (files?.photo) await saveDocument(prisma, orgId, files.photo, { kind: "PHOTO", name: "Photo", tenantId, uploadedById: membershipId });
  if (files?.agreementDoc && agreementId) {
    await saveDocument(prisma, orgId, files.agreementDoc, { kind: "AGREEMENT", name: "Agreement", tenantId, agreementId, assetId: assetId ?? undefined, uploadedById: membershipId });
  }
}

export class TenantService {
  private agreements = new AgreementService();

  /** "Add tenant" on a flat: creates the person and an active agreement at the flat's asking rent. */
  async create(orgId: string, flatId: string, input: CreateTenantInput, files?: TenantFiles) {
    const oid = toNumberId(orgId);
    const flat = await prisma.flat.findFirst({ where: { id: toNumberId(flatId), floor: { building: { orgId: oid } } } });
    if (!flat) throw new NotFoundError("Flat not found");

    const tenant = await prisma.tenant.create({
      data: { ...personal(input), email: input.email || null, photo: files?.photo?.path || null, orgId: oid },
    });
    const { agreement, warnings } = await this.agreements.create(oid, {
      flatId: Number(flat.id),
      tenantId: Number(tenant.id),
      startDate: ymd(input.moveInDate),
      endDate: input.moveOutDate ? ymd(input.moveOutDate) : undefined,
      deposit: input.deposit,
      activate: input.status !== "FORMER",
      firstInvoice: false,
    }).catch(async (e) => {
      await prisma.tenant.delete({ where: { id: tenant.id } }); // keep it all-or-nothing
      throw e;
    });
    if (files?.agreementDoc) await prisma.agreement.update({ where: { id: agreement.id }, data: { documentPath: files.agreementDoc.path } });
    await toVault(oid, files, tenant.id, agreement.id, flat.assetId);
    return { ...(await this.findById(orgId, String(tenant.id))), warnings };
  }

  /** Everyone who has had an agreement on this flat, latest first. */
  async findAll(orgId: string, flatId: string) {
    const flat = await prisma.flat.findFirst({ where: { id: toNumberId(flatId), floor: { building: { orgId: toNumberId(orgId) } } } });
    if (!flat) throw new NotFoundError("Flat not found");
    const tenants = await prisma.tenant.findMany({
      where: { agreements: { some: { assetId: flat.assetId } } },
      orderBy: { createdAt: "desc" },
      include: { agreements: { ...stayInclude.agreements, where: { assetId: flat.assetId } } },
    });
    return tenants.map(withStay);
  }

  async findAllByOwner(orgId: string) {
    const tenants = await prisma.tenant.findMany({ where: { orgId: toNumberId(orgId) }, orderBy: { createdAt: "desc" }, include: stayInclude });
    return tenants.map(withStay);
  }

  async findById(orgId: string, id: string) {
    const tenant = await prisma.tenant.findFirst({ where: { id: toNumberId(id), orgId: toNumberId(orgId) }, include: stayInclude });
    if (!tenant) throw new NotFoundError("Tenant not found");
    return withStay(tenant);
  }

  /**
   * Personal details are saved on the person. The old "move-out date / former" fields end the
   * running agreement (no deposit settlement: use the agreement's Move out for that).
   */
  async update(orgId: string, id: string, input: UpdateTenantInput, files?: TenantFiles) {
    const current = await this.findById(orgId, id);
    const data: Prisma.TenantUpdateInput = { ...personal(input) };
    if (input.email !== undefined) data.email = input.email || null;
    if (files?.photo) data.photo = files.photo.path;
    await prisma.tenant.update({ where: { id: toNumberId(id) }, data });

    const live = current.agreementId && (current.agreementStatus === "ACTIVE" || current.agreementStatus === "NOTICE");
    if (live && (input.status === "FORMER" || input.moveOutDate)) {
      const endDate = ymd(input.moveOutDate);
      await prisma.$transaction(async (tx) => {
        const a = await tx.agreement.update({ where: { id: current.agreementId! }, data: { status: "ENDED", endDate: new Date(`${endDate}T00:00:00.000Z`) } });
        await syncAssetStatus(a.assetId, tx);
      });
    }
    if (files?.agreementDoc && current.agreementId) {
      await prisma.agreement.update({ where: { id: current.agreementId }, data: { documentPath: files.agreementDoc.path } });
    }
    await toVault(toNumberId(orgId), files, BigInt(id), current.agreementId);
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: toNumberId(id), orgId: toNumberId(orgId) },
      include: { agreements: { select: { assetId: true } }, _count: { select: { invoices: true } } },
    });
    if (!tenant) throw new NotFoundError("Tenant not found");
    if (tenant._count.invoices) throw new ValidationError("This tenant has invoices. End their agreement instead of deleting them.");

    await prisma.$transaction(async (tx) => {
      await tx.agreement.deleteMany({ where: { tenantId: tenant.id } });
      await tx.tenant.delete({ where: { id: tenant.id } });
      for (const a of tenant.agreements) await syncAssetStatus(a.assetId, tx);
    });
  }
}
