import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/** Who is acting in this request; set by requireOrg so services can audit without a req parameter. */
/** A staff member (userId + membershipId) or a tenant in the portal (tenantId). */
export interface Actor { orgId: number; userId?: number; membershipId?: number; tenantId?: number; ip?: string; userAgent?: string }
export const actorStore = new AsyncLocalStorage<Actor>();

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Append an audit row for the current actor. Pass the transaction client so the row commits with the change.
 * Outside a request (cron, seed) there is no actor and nothing is written.
 */
export async function audit(db: Db, action: string, entity: string, entityId?: bigint | number | null, metadata?: Prisma.InputJsonValue) {
  const a = actorStore.getStore();
  if (!a) return;
  await (db ?? prisma).auditLog.create({
    data: {
      orgId: a.orgId,
      userId: a.userId,
      tenantId: a.tenantId,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      metadata,
      ipAddress: a.ip?.slice(0, 45),
      userAgent: a.userAgent,
    },
  });
}
