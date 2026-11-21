import fs from "fs";
import path from "path";
import { z } from "zod";
import type { DocumentKind, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { uploadsDir } from "../../shared/utils/upload";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";

const id = z.coerce.number().int().positive().optional();
export const uploadSchema = z.object({
  kind: z.enum(["NID", "AGREEMENT", "PHOTO", "UTILITY", "OTHER"]).default("OTHER"),
  name: z.string().trim().max(200).optional(),
  tenantId: id,
  assetId: id,
  agreementId: id,
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
});
export type UploadInput = z.infer<typeof uploadSchema>;

export const listSchema = z.object({ tenantId: id, assetId: id, agreementId: id, expiring: z.coerce.number().int().positive().optional() });

type Db = PrismaClient | Prisma.TransactionClient;
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
