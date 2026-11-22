import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { limitFor, PLAN_NAMES } from "../../shared/plans";
import { generateSupportToken } from "../../shared/utils/jwt";
import { env } from "../../config/env";
import { gatewayBalance } from "../notification/sms.sender";

export const listSchema = z.object({ search: z.string().trim().max(100).optional() });
export const planSchema = z
  .object({
    plan: z.enum(PLAN_NAMES as [string, ...string[]]).optional(),
    unitLimit: z.number().int().min(1).max(100000).nullable().optional(),
    /** YYYY-MM-DD, or null for no expiry */
    paidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    suspended: z.boolean().optional(),
  })
  .refine((v) => v.plan !== "CUSTOM" || v.unitLimit, { message: "A custom plan needs a unit limit", path: ["unitLimit"] });
export const creditSchema = z.object({ amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Enter a non-zero amount"), reason: z.string().trim().min(2).max(255) });

/** The super-admin acts outside any workspace, so audit rows are written directly on the target org. */
const auditOn = (db: Prisma.TransactionClient | typeof prisma, orgId: bigint, userId: number, action: string, metadata: Prisma.InputJsonValue) =>
  db.auditLog.create({ data: { orgId, userId, action, entity: "Organization", entityId: String(orgId), metadata } });

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

export class AdminService {
  /** Every workspace with its owner, plan use, SMS and activity (a handful of grouped queries, not one per org). */
  async list(q: z.infer<typeof listSchema>) {
    const s = q.search;
    const orgs = await prisma.organization.findMany({
      where: s ? { OR: [{ name: { contains: s } }, { memberships: { some: { role: "OWNER", user: { OR: [{ email: { contains: s } }, { phone: { contains: s } }] } } } }] } : {},
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, name: true, plan: true, unitLimit: true, paidUntil: true, suspendedAt: true, smsCredits: true, createdAt: true,
        memberships: { where: { role: "OWNER" }, take: 1, orderBy: { createdAt: "asc" }, select: { user: { select: { firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } } } },
      },
    });
    const ids = orgs.map((o) => o.id);
    if (!ids.length) return [];
    const [flats, vehicles, sms, open] = await Promise.all([
      prisma.$queryRaw<{ orgId: bigint; n: bigint }[]>`
        SELECT b.orgId AS orgId, COUNT(*) AS n FROM flats f JOIN floors fl ON fl.id = f.floorId JOIN buildings b ON b.id = fl.buildingId
        WHERE b.orgId IN (${Prisma.join(ids)}) GROUP BY b.orgId`,
      prisma.vehicle.groupBy({ by: ["orgId"], where: { orgId: { in: ids } }, _count: true }),
      prisma.notification.groupBy({ by: ["orgId"], where: { orgId: { in: ids }, status: "SENT", sentAt: { gte: monthStart() } }, _sum: { segments: true } }),
      prisma.invoice.groupBy({ by: ["orgId"], where: { orgId: { in: ids }, carriedForward: false, dueAmount: { gt: 0 } }, _count: true }),
    ]);
    const by = <T extends { orgId: bigint }>(rows: T[]) => new Map(rows.map((r) => [String(r.orgId), r]));
    const [f, v, m, o] = [by(flats), by(vehicles), by(sms), by(open)];
    return orgs.map(({ memberships, ...org }) => {
      const id = String(org.id);
      const units = Number(f.get(id)?.n ?? 0);
      const veh = v.get(id)?._count ?? 0;
      const { limit, expired } = limitFor(org);
      return {
        ...org,
        owner: memberships[0]?.user ?? null,
        units, vehicles: veh, used: units + veh, limit, expired,
        smsUsedThisMonth: m.get(id)?._sum.segments ?? 0,
        openInvoices: o.get(id)?._count ?? 0,
      };
    });
  }

  async update(adminId: number, id: number, input: z.infer<typeof planSchema>) {
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundError("Workspace not found");
    const data: Prisma.OrganizationUpdateInput = {
      ...(input.plan !== undefined && { plan: input.plan }),
      ...(input.unitLimit !== undefined && { unitLimit: input.unitLimit }),
      ...(input.paidUntil !== undefined && { paidUntil: input.paidUntil ? new Date(`${input.paidUntil}T23:59:59+06:00`) : null }),
      ...(input.suspended !== undefined && { suspendedAt: input.suspended ? org.suspendedAt ?? new Date() : null }),
    };
    if ((input.plan ?? org.plan) === "CUSTOM" && !(input.unitLimit ?? org.unitLimit)) throw new ValidationError("A custom plan needs a unit limit");
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data });
      const { suspended, ...plan } = input;
      if (Object.keys(plan).length) await auditOn(tx, org.id, adminId, "admin.plan", { before: { plan: org.plan, unitLimit: org.unitLimit, paidUntil: org.paidUntil?.toISOString() ?? null }, after: plan as any });
      if (suspended !== undefined && suspended !== !!org.suspendedAt) await auditOn(tx, org.id, adminId, suspended ? "admin.suspend" : "admin.reactivate", {});
    });
    return (await this.list({})).find((o) => o.id === org.id);
  }

  /** Top up (or correct) a workspace's prepaid SMS balance; never below zero. */
  async credits(adminId: number, id: number, input: z.infer<typeof creditSchema>) {
    const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, smsCredits: true } });
    if (!org) throw new NotFoundError("Workspace not found");
    if (org.smsCredits + input.amount < 0) throw new ValidationError(`The balance is ${org.smsCredits}; it can't go below zero`);
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data: { smsCredits: { increment: input.amount } } });
      await tx.smsCreditEntry.create({ data: { orgId: org.id, delta: input.amount, reason: input.reason, byUserId: adminId } });
      await auditOn(tx, org.id, adminId, "admin.credits", { amount: input.amount, reason: input.reason, before: org.smsCredits });
    });
    const entries = await prisma.smsCreditEntry.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 20 });
    return { smsCredits: org.smsCredits + input.amount, entries };
  }

  async creditHistory(id: number) {
    return prisma.smsCreditEntry.findMany({ where: { orgId: id }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  smsBalance() {
    return gatewayBalance();
  }

  /** "Open as owner": a short read-only token for that workspace; the owner sees it in their Activity log. */
  async support(admin: { userId: string; email: string }, id: number) {
    const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!org) throw new NotFoundError("Workspace not found");
    await auditOn(prisma, org.id, Number(admin.userId), "support.open", { readOnly: true, minutes: env.supportTokenTtl });
    return {
      accessToken: generateSupportToken({ userId: admin.userId, email: admin.email, role: "SUPER_ADMIN" }, org.id),
      orgId: String(org.id),
      orgName: org.name,
      expiresIn: env.supportTokenTtl,
    };
  }
}
