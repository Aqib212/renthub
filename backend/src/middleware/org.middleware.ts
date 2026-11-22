import { Response, NextFunction } from "express";
import { prisma } from "../shared/prisma";
import { ForbiddenError, UnauthorizedError } from "../shared/utils/errors";
import { toNumberId } from "../shared/utils/helpers";
import { can, type Action } from "../shared/permissions";
import { actorStore } from "../shared/audit";
import type { AuthRequest } from "./auth.middleware";

export type OrgRequest = AuthRequest;

/**
 * Resolves the workspace for this request: the `X-Org-Id` header, or the user's only membership.
 * Every business query is scoped by `req.org.id`.
 */
export const requireOrg = async (req: OrgRequest, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new UnauthorizedError("Not authenticated"));
    const userId = toNumberId(req.user.userId);
    const header = req.header("x-org-id");

    // super-admin support view: the workspace as its owner sees it, and nothing can be changed
    if (req.user.support) {
      if (req.method !== "GET" && req.method !== "HEAD") return next(new ForbiddenError("Support view is read-only"));
      if (header && Number(toNumberId(header)) !== req.user.support) return next(new ForbiddenError("This support session is for another workspace"));
      const owner = await prisma.membership.findFirst({ where: { orgId: req.user.support, role: "OWNER" }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!owner) return next(new ForbiddenError("This workspace has no owner"));
      req.org = { id: req.user.support, membershipId: Number(owner.id), role: "OWNER", buildingIds: null };
      return actorStore.run({ orgId: req.org.id, userId: Number(userId), buildingIds: null, ip: req.ip, userAgent: req.get("user-agent") }, next);
    }

    const memberships = await prisma.membership.findMany({
      where: { userId, isActive: true, ...(header ? { orgId: toNumberId(header) } : {}) },
      select: { id: true, orgId: true, role: true, buildingIds: true, org: { select: { suspendedAt: true } } },
      take: 2,
    });
    if (!memberships.length) return next(new ForbiddenError("You are not a member of this organisation"));
    if (!header && memberships.length > 1) return next(new ForbiddenError("Choose an organisation (X-Org-Id header)"));

    const m = memberships[0];
    if (m.org.suspendedAt) return next(new ForbiddenError("This workspace is suspended. Contact RentHub."));
    req.org = {
      id: Number(m.orgId),
      membershipId: Number(m.id),
      role: m.role,
      buildingIds: Array.isArray(m.buildingIds) ? (m.buildingIds as unknown[]).map(Number) : null,
    };
    // the owner always sees everything; other members may be limited to some buildings (shared/scope.ts)
    const buildingIds = m.role === "OWNER" ? null : req.org.buildingIds;
    actorStore.run({ orgId: req.org.id, userId: Number(userId), membershipId: req.org.membershipId, buildingIds, ip: req.ip, userAgent: req.get("user-agent") }, next);
  } catch (e) {
    next(e);
  }
};

/** Route guard: the member's role must allow `action` (see shared/permissions.ts). */
export const permit = (action: Action) => (req: OrgRequest, _res: Response, next: NextFunction) =>
  req.org && can(req.org.role, action) ? next() : next(new ForbiddenError("Your role does not allow this"));

/** Router-wide guard: any member may read; changing data needs `action`. */
export const writes = (action: Action) => (req: OrgRequest, res: Response, next: NextFunction) =>
  req.method === "GET" || req.method === "HEAD" ? next() : permit(action)(req, res, next);
