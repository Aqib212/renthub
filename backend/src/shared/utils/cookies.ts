import type { Request, Response } from "express";
import { env } from "../../config/env";

/** One cookie from the request header (no cookie-parser needed). */
export function readCookie(req: Pick<Request, "headers">, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** "7d" / "12h" / "30m" / seconds -> ms (the JWT expiry format). */
export const durationMs = (s: string) => {
  const m = /^(\d+)\s*([dhms]?)$/.exec(s.trim());
  if (!m) return 7 * 86_400_000;
  return Number(m[1]) * { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000, "": 1000 }[m[2] as "d"];
};

/** Refresh tokens live in an httpOnly cookie scoped to the auth routes, never in JS-readable storage. */
const opts = (path: string) => ({ httpOnly: true, sameSite: "strict" as const, secure: env.nodeEnv === "production", path });
export const STAFF_RT = { name: "rh_rt", path: "/api/v1/auth" };
export const PORTAL_RT = { name: "rh_prt", path: "/api/v1/portal/auth" };
export const setRefreshCookie = (res: Response, c: { name: string; path: string }, token: string, maxAgeMs: number) =>
  res.cookie(c.name, token, { ...opts(c.path), maxAge: maxAgeMs });
export const clearRefreshCookie = (res: Response, c: { name: string; path: string }) => res.clearCookie(c.name, opts(c.path));
