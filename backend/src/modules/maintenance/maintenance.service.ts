import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { LIVE } from "../bill-type/bill-type.service";
import { syncUnitStatus } from "../agreement/agreement.service";
import { discardFile, saveDocument } from "../document/document.service";

const STATUS = ["NEW", "ASSIGNED", "WAITING", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
const PRIORITY = ["LOW", "NORMAL", "URGENT"] as const;
const optId = z.coerce.number().int().positive().nullable().optional();

export const createSchema = z.object({
  flatId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  category: z.string().trim().max(50).nullable().optional(),
  priority: z.enum(PRIORITY).optional(),
  assignedToId: optId,
  /** the (vacant) unit can't be let until this is fixed */
  blocksUnit: z.boolean().optional(),
});
export const updateSchema = createSchema.omit({ flatId: true }).partial().extend({
  status: z.enum(STATUS).optional(),
  cost: z.coerce.number().min(0).nullable().optional(),
  /** on DONE with a cost: record it as a REPAIRS expense */
  createExpense: z.boolean().optional(),
});
export const listSchema = z.object({
  status: z.enum([...STATUS, "OPEN"]).optional(),
  buildingId: z.coerce.number().int().positive().optional(),
  flatId: z.coerce.number().int().positive().optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;

const OPEN: (typeof STATUS)[number][] = ["NEW", "ASSIGNED", "WAITING", "IN_PROGRESS"];
const userName = { user: { select: { firstName: true, lastName: true } } } as const;
const include = {
  asset: { select: { unit: { select: { id: true, name: true, status: true, floor: { select: { name: true, building: { select: { id: true, name: true } } } } } } } },
  tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedTo: { select: { id: true, ...userName } },
  createdBy: { select: { id: true, ...userName } },
  expense: { select: { id: true, amount: true } },
  photos: { select: { id: true, name: true, mime: true }, orderBy: { id: "asc" } },
} satisfies Prisma.MaintenanceRequestInclude;
type Row = Prisma.MaintenanceRequestGetPayload<{ include: typeof include }>;

const nameOf = (m: { user: { firstName: string; lastName: string } } | null) => (m ? `${m.user.firstName} ${m.user.lastName}` : null);
const shape = ({ asset, tenant, assignedTo, createdBy, ...r }: Row) => ({
  ...r,
  cost: r.cost === null ? null : Number(r.cost),
  unit: asset.unit && { id: asset.unit.id, name: asset.unit.name, status: asset.unit.status, floorName: asset.unit.floor.name, building: asset.unit.floor.building },
  tenant: tenant && { id: tenant.id, name: `${tenant.firstName} ${tenant.lastName}`, phone: tenant.phone },
  assignedTo: assignedTo && { id: assignedTo.id, name: nameOf(assignedTo) },
  createdBy: createdBy && { id: createdBy.id, name: nameOf(createdBy) },
});

export class MaintenanceService {
  private async own(orgId: number, id: number) {
    const r = await prisma.maintenanceRequest.findFirst({ where: { id, orgId }, include });
    if (!r) throw new NotFoundError("Request not found");
    return r;
  }

  private async assertMember(orgId: number, id?: number | null) {
    if (id && !(await prisma.membership.count({ where: { id, orgId, isActive: true } }))) throw new NotFoundError("Staff member not found");
  }

  async list(orgId: number, q: z.infer<typeof listSchema>) {
    const where: Prisma.MaintenanceRequestWhereInput = {
      orgId,
      ...(q.status === "OPEN" ? { status: { in: OPEN } } : q.status ? { status: q.status } : {}),
      ...(q.assignedToId ? { assignedToId: q.assignedToId } : {}),
      ...(q.flatId ? { asset: { unit: { id: q.flatId } } } : q.buildingId ? { asset: { unit: { floor: { buildingId: q.buildingId } } } } : {}),
    };
    const [rows, total, counts] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include,
        orderBy: [{ resolvedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.maintenanceRequest.count({ where }),
      prisma.maintenanceRequest.groupBy({ by: ["status"], where: { orgId }, _count: true }),
    ]);
    return {
      data: { rows: rows.map(shape), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) },
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    };
  }

  async assignees(orgId: number) {
    const ms = await prisma.membership.findMany({ where: { orgId, isActive: true }, select: { id: true, role: true, ...userName }, orderBy: { id: "asc" } });
    return ms.map((m) => ({ id: m.id, role: m.role, name: nameOf(m) }));
  }

  async get(orgId: number, id: number) {
    return shape(await this.own(orgId, id));
  }

  async create(orgId: number, membershipId: number | null, input: CreateInput) {
    const flat = await prisma.flat.findFirst({
      where: { id: input.flatId, floor: { building: { orgId } } },
      include: { asset: { select: { agreements: { where: LIVE, take: 1, orderBy: { startDate: "desc" }, select: { tenantId: true } } } } },
    });
    if (!flat) throw new NotFoundError("Unit not found");
    await this.assertMember(orgId, input.assignedToId);
    // only a vacant unit is taken off the market; an occupied one stays occupied
    const blocksUnit = !!input.blocksUnit && flat.status === "VACANT";

    const r = await prisma.$transaction(async (tx) => {
      const r = await tx.maintenanceRequest.create({
        data: {
          orgId,
          assetId: flat.assetId,
          tenantId: flat.asset.agreements[0]?.tenantId ?? null,
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? null,
          priority: input.priority ?? "NORMAL",
          assignedToId: input.assignedToId ?? null,
          status: input.assignedToId ? "ASSIGNED" : "NEW",
          createdById: membershipId,
          blocksUnit,
        },
      });
      if (blocksUnit) await tx.flat.update({ where: { id: flat.id }, data: { status: "UNDER_MAINTENANCE" } });
      await audit(tx, "maintenance.create", "MaintenanceRequest", r.id, { unit: flat.name, title: input.title });
      return r;
    });
    return this.get(orgId, Number(r.id));
  }

  async update(orgId: number, id: number, input: UpdateInput) {
    const r = await this.own(orgId, id);
    await this.assertMember(orgId, input.assignedToId);
    const status = input.status ?? (input.assignedToId && r.status === "NEW" ? "ASSIGNED" : r.status);
    const closing = (status === "DONE" || status === "CANCELLED") && !r.resolvedAt;
    const reopening = OPEN.includes(status as any) && !!r.resolvedAt;
    const cost = input.cost !== undefined ? input.cost : r.cost === null ? null : Number(r.cost);
    const unit = r.asset.unit;

    await prisma.$transaction(async (tx) => {
      let expenseId = r.expenseId;
      if (input.createExpense && status === "DONE" && cost && !expenseId) {
        if (!unit) throw new ValidationError("Expenses can only be recorded for units");
        const e = await tx.expense.create({
          data: { orgId, buildingId: unit.floor.building.id, category: "REPAIRS", amount: cost, description: `${r.title} (${unit.name})`, date: new Date() },
        });
        expenseId = e.id;
      }
      await tx.maintenanceRequest.update({
        where: { id: r.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.assignedToId !== undefined && { assignedToId: input.assignedToId }),
          status,
          cost,
          expenseId,
          ...(closing && { resolvedAt: new Date() }),
          ...(reopening && { resolvedAt: null }),
        },
      });
      // a closed request gives the unit back
      if (closing && r.blocksUnit && unit?.status === "UNDER_MAINTENANCE") {
        await tx.flat.update({ where: { id: unit.id }, data: { status: "VACANT" } });
        await syncUnitStatus(r.assetId, tx);
      }
      if (closing || input.cost !== undefined || expenseId !== r.expenseId) {
        await audit(tx, closing ? `maintenance.${status.toLowerCase()}` : "maintenance.update", "MaintenanceRequest", r.id, {
          title: r.title, status, cost, expenseId: expenseId ? Number(expenseId) : null,
        });
      }
    });
    return this.get(orgId, id);
  }

  async addPhotos(orgId: number, membershipId: number | null, id: number, files: Express.Multer.File[] = []) {
    try {
      const r = await this.own(orgId, id);
      if (!files.length) throw new ValidationError("Choose a photo");
      if (r.photos.length + files.length > 8) throw new ValidationError("At most 8 photos per request");
      if (files.some((f) => !f.mimetype.startsWith("image/"))) throw new ValidationError("Photos must be images");
      for (const f of files) {
        await saveDocument(prisma, orgId, f, { kind: "PHOTO", maintenanceId: r.id, assetId: r.assetId, uploadedById: membershipId ?? undefined });
      }
    } catch (e) {
      await Promise.all(files.map(discardFile));
      throw e;
    }
    return this.get(orgId, id);
  }

  async remove(orgId: number, id: number) {
    const r = await this.own(orgId, id);
    if (r.status !== "NEW") throw new ValidationError("Only a new request can be deleted; cancel it instead");
    const files = await prisma.document.findMany({ where: { maintenanceId: r.id }, select: { path: true } });
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceRequest.delete({ where: { id: r.id } }); // photos cascade
      if (r.blocksUnit && r.asset.unit?.status === "UNDER_MAINTENANCE") await tx.flat.update({ where: { id: r.asset.unit.id }, data: { status: "VACANT" } });
      await audit(tx, "maintenance.delete", "MaintenanceRequest", r.id, { title: r.title });
    });
    await Promise.all(files.map((f) => discardFile({ filename: f.path })));
    return { id: r.id };
  }
}
