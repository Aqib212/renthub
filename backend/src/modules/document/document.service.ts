import fs from "fs";
import path from "path";
import { z } from "zod";
import type { DocumentKind, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { uploadsDir } from "../../shared/utils/upload";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { currentDocs, daysLeft } from "../../shared/notify/expiry";
import { vehicleLabel } from "../../shared/utils/asset";

const id = z.coerce.number().int().positive().optional();
export const uploadSchema = z.object({
  kind: z.enum(["NID", "AGREEMENT", "PHOTO", "UTILITY", "OTHER", "REGISTRATION", "FITNESS", "TAX_TOKEN", "ROUTE_PERMIT", "INSURANCE", "LICENCE", "ENLISTMENT"]).default("OTHER"),
  name: z.string().trim().max(200).optional(),
  tenantId: id,
  assetId: id,
  agreementId: id,
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
});
export type UploadInput = z.infer<typeof uploadSchema>;

export const listSchema = z.object({ tenantId: id, assetId: id, agreementId: id, expiring: z.coerce.number().int().positive().optional() });

type Db = PrismaClient | Prisma.TransactionClient;

export const expiringSchema = z.object({ days: z.coerce.number().int().min(0).max(365).default(30) });

/**
 * Documents that expire within `days` of `today` (or already have), newest renewal only, soonest first,
 * each with what it belongs to. Shared by the dashboard list and the daily reminder SMS.
 */
export async function expiringDocs(orgId: number, days: number, today: Date) {
  const until = new Date(today.getTime() + days * 86_400_000);
  // every dated document, so a later renewal can supersede one that is about to expire
  const docs = await prisma.document.findMany({
    where: { orgId, expiresAt: { not: null } },
    select: {
      id: true, kind: true, name: true, expiresAt: true, tenantId: true, assetId: true, agreementId: true,
      tenant: { select: { firstName: true, lastName: true } },
      asset: { select: { unit: { select: { id: true, name: true } }, vehicle: { select: { id: true, regNo: true, type: true } } } },
      agreement: { select: { id: true, tenant: { select: { firstName: true, lastName: true } } } },
    },
  });
  return currentDocs(docs)
    .filter((d) => d.expiresAt! <= until)
    .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())
    .map(({ tenant, asset, agreement, ...d }) => ({
      ...d,
      daysLeft: daysLeft(d.expiresAt!, today),
      owner: asset?.vehicle
        ? { type: "vehicle" as const, id: asset.vehicle.id, label: vehicleLabel(asset.vehicle) }
        : asset?.unit
          ? { type: "unit" as const, id: asset.unit.id, label: asset.unit.name }
          : tenant
            ? { type: "tenant" as const, id: d.tenantId!, label: `${tenant.firstName} ${tenant.lastName}` }
            : agreement
              ? { type: "agreement" as const, id: agreement.id, label: `${agreement.tenant.firstName} ${agreement.tenant.lastName}` }
              : null,
    }));
}
type File = { filename: string; originalname: string; mimetype: string; size: number };

/** Store an already-uploaded multer file as a vault row. Used by the vault, tenant forms and maintenance photos. */
export function saveDocument(
  db: Db,
  orgId: number,
  file: File,
  data: { kind?: DocumentKind; name?: string; tenantId?: number | bigint; assetId?: number | bigint; agreementId?: number | bigint; maintenanceId?: number | bigint; expiresAt?: string; uploadedById?: number }
) {
  return db.document.create({
    data: {
      orgId,
      kind: data.kind ?? "OTHER",
      name: data.name || file.originalname.slice(0, 200),
      path: file.filename,
      mime: file.mimetype,
      size: file.size,
      tenantId: data.tenantId,
      assetId: data.assetId,
      agreementId: data.agreementId,
      maintenanceId: data.maintenanceId,
      expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T00:00:00Z`) : null,
      uploadedById: data.uploadedById,
    },
  });
}

/** Remove a file left behind by a request that failed validation. */
export const discardFile = (file?: { filename: string }) => file && fs.promises.unlink(path.join(uploadsDir, file.filename)).catch(() => {});

export class DocumentService {
  async create(orgId: number, membershipId: number, file: File | undefined, body: unknown) {
    if (!file) throw new ValidationError("Choose a file to upload");
    try {
      const parsed = uploadSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
      const input: UploadInput = parsed.data;
      if (!input.tenantId && !input.assetId && !input.agreementId) throw new ValidationError("Attach the file to a tenant, unit or agreement");
      // linked rows must belong to this organisation
      const checks = await Promise.all([
        input.tenantId ? prisma.tenant.count({ where: { id: input.tenantId, orgId } }) : 1,
        input.assetId ? prisma.asset.count({ where: { id: input.assetId, orgId } }) : 1,
        input.agreementId ? prisma.agreement.count({ where: { id: input.agreementId, orgId } }) : 1,
      ]);
      if (checks.includes(0)) throw new NotFoundError("Tenant, unit or agreement not found");
      return await saveDocument(prisma, orgId, file, { ...input, uploadedById: membershipId });
    } catch (e) {
      await discardFile(file);
      throw e;
    }
  }

  async list(orgId: number, q: z.infer<typeof listSchema>) {
    const soon = q.expiring ? new Date(Date.now() + q.expiring * 86_400_000) : null;
    return prisma.document.findMany({
      where: {
        orgId,
        ...(q.tenantId ? { tenantId: q.tenantId } : {}),
        ...(q.assetId ? { assetId: q.assetId } : {}),
        ...(q.agreementId ? { agreementId: q.agreementId } : {}),
        ...(soon ? { expiresAt: { not: null, lte: soon } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { uploadedBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  /** Absolute path of a document's file, after the org check. */
  async file(orgId: number, id: number) {
    const doc = await prisma.document.findFirst({ where: { id, orgId } });
    if (!doc) throw new NotFoundError("Document not found");
    const abs = path.join(uploadsDir, path.basename(doc.path));
    if (!fs.existsSync(abs)) throw new NotFoundError("The file is missing on the server");
    return { doc, abs };
  }

  async remove(orgId: number, id: number) {
    const doc = await prisma.document.findFirst({ where: { id, orgId } });
    if (!doc) throw new NotFoundError("Document not found");
    await prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id: doc.id } });
      await audit(tx, "document.delete", "Document", doc.id, { name: doc.name, kind: doc.kind });
    });
    await discardFile({ filename: path.basename(doc.path) });
    return { id: doc.id };
  }
}
