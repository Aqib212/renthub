import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../shared/utils/jwt";
import { UnauthorizedError, ForbiddenError } from "../shared/utils/errors";
import { UserRole, OrgRole } from "@prisma/client";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
  /** Set by requireOrg (org.middleware.ts) on every business route. */
  org?: { id: number; membershipId: number; role: OrgRole; buildingIds: number[] | null };
}

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("No token provided"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role as UserRole,
    };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }

    next();
  };
};
