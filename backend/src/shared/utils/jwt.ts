import jwt from "jsonwebtoken";
import { env } from "../../config/env";

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as any,
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as any,
  });
};

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
