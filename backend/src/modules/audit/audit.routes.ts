import { Router, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { requireOrg, permit } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { prisma } from "../../shared/prisma";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  action: z.string().max(100).optional(), // prefix, e.g. "payment" or "payment.delete"
  userId: z.coerce.number().int().positive().optional(),
  entity: z.string().max(100).optional(),
  entityId: z.string().max(40).optional(),
  dateFrom: day.optional(),
  dateTo: day.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const router = Router();
router.use(authenticate, requireOrg, permit("audit:read"));

/** The workspace's activity log, newest first. Rows are written by shared/audit.ts. */
router.get("/", validate(querySchema, "query"), asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as unknown as z.infer<typeof querySchema>;
  const where: Prisma.AuditLogWhereInput = {
    orgId: req.org!.id,
    ...(q.action && { action: { startsWith: q.action } }),
    ...(q.userId && { userId: q.userId }),
    ...(q.entity && { entity: q.entity }),
    ...(q.entityId && { entityId: q.entityId }),
    ...((q.dateFrom || q.dateTo) && {
      createdAt: { ...(q.dateFrom && { gte: new Date(`${q.dateFrom}T00:00:00`) }), ...(q.dateTo && { lte: new Date(`${q.dateTo}T23:59:59.999`) }) },
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: { id: true, action: true, entity: true, entityId: true, metadata: true, ipAddress: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true } }, tenant: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  sendResult(res, { data: rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } });
}));

export default router;
