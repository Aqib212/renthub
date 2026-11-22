import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { actorStore } from "./actor";

export { actorStore, type Actor } from "./actor";

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
