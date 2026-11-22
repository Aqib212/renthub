import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  /** support view: the super-admin looks at this workspace as its owner, read-only */
  sup?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as any,
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  // a random jwtid makes every refresh token unique, so rotation really retires the old one (even within the same second)
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as any,
    jwtid: randomUUID(),
  });
};

/** Short-lived, read-only "open as owner" token for the super-admin. No refresh token goes with it. */
export const generateSupportToken = (payload: TokenPayload, orgId: number | bigint): string =>
  jwt.sign({ ...payload, sup: String(orgId) }, env.jwt.accessSecret, { expiresIn: env.supportTokenTtl as any });

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.accessSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.refreshSecret) as TokenPayload;
};

/** Tenant portal access token. `typ: "tenant"` keeps it from ever passing staff `authenticate`. */
export interface PortalTokenPayload { typ: "tenant"; phone: string; sid: string }

export const generatePortalAccessToken = (payload: Omit<PortalTokenPayload, "typ">): string =>
  jwt.sign({ ...payload, typ: "tenant" }, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn as any });

export const verifyPortalAccessToken = (token: string): PortalTokenPayload => {
  const p = jwt.verify(token, env.jwt.accessSecret) as Partial<PortalTokenPayload>;
  if (p.typ !== "tenant" || !p.phone || !p.sid) throw new Error("Not a portal token");
  return p as PortalTokenPayload;
};
