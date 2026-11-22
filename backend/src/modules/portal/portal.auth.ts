import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { actorStore } from "../../shared/audit";
import { normalizeBdPhone } from "../../shared/notify/phone";
import { otpText } from "../../shared/notify/templates";
import { generateOtp } from "../../shared/utils/generateOtp";
import { generatePortalAccessToken, verifyPortalAccessToken } from "../../shared/utils/jwt";
import { TooManyRequestsError, UnauthorizedError, ValidationError } from "../../shared/utils/errors";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { PORTAL_RT, clearRefreshCookie, readCookie, setRefreshCookie } from "../../shared/utils/cookies";
import { validate } from "../../middleware/validate.middleware";
import { portalAuthRateLimiter } from "../../middleware/rateLimiter.middleware";
import { sendSms } from "../notification/sms.sender";

const OTP_MINUTES = 5;
const MAX_TRIES = 5;
const SESSION_DAYS = 60;
const MIN = 60_000;

/**
 * Login-code throttle: at most one code a minute and five an hour per phone.
 * `sent` are the times earlier codes were sent. Returns 0 when allowed, else seconds to wait.
 */
export function otpThrottle(sent: Date[], now: Date): number {
  const t = now.getTime();
  const lastHour = sent.map((d) => d.getTime()).filter((x) => x > t - 60 * MIN).sort((a, b) => a - b);
  const latest = lastHour.at(-1);
  if (latest !== undefined && t - latest < MIN) return Math.ceil((MIN - (t - latest)) / 1000);
  if (lastHour.length >= 5) return Math.ceil((lastHour[0] + 60 * MIN - t) / 1000);
  return 0;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const phoneSchema = z.string().trim().min(6).max(20).transform((v, ctx) => {
  const p = normalizeBdPhone(v);
  if (!p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a Bangladeshi mobile number (01XXXXXXXXX)" });
  return p ?? "";
});
const requestSchema = z.object({ phone: phoneSchema, lang: z.enum(["BN", "EN"]).optional() });
const verifySchema = z.object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

/** Tenants this phone may see: matching phone, in orgs that have the portal on, with a real agreement. */
async function tenantIdsFor(phone: string) {
  const rows = await prisma.tenant.findMany({
    where: { phoneNormalized: phone, agreements: { some: { status: { not: "DRAFT" } } } },
    select: { id: true, lang: true, org: { select: { settings: true } } },
  });
  return rows.filter((r) => (r.org.settings as any)?.portal?.enabled !== false);
}

async function openSession(phone: string, userAgent?: string) {
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  const s = await prisma.portalSession.create({
    data: { phone, refreshHash: sha256(refreshToken), expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * MIN), userAgent: userAgent?.slice(0, 255) },
  });
  return { accessToken: generatePortalAccessToken({ phone, sid: String(s.id) }), refreshToken, phone };
}

export interface PortalRequest extends Request {
  portal?: { phone: string; sessionId: number; tenantIds: number[] };
}

/** Guard for tenant portal routes: a valid tenant token whose device session still exists. */
export const tenantAuth = async (req: PortalRequest, _res: Response, next: NextFunction) => {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return next(new UnauthorizedError("Please log in"));
    let p;
    try {
      p = verifyPortalAccessToken(h.slice(7));
    } catch {
      return next(new UnauthorizedError("Invalid or expired token"));
    }
    const s = await prisma.portalSession.findUnique({ where: { id: BigInt(p.sid) } });
    if (!s || s.phone !== p.phone || s.expiresAt < new Date()) return next(new UnauthorizedError("Session ended, please log in again"));
    if (Date.now() - s.lastSeenAt.getTime() > 10 * MIN) await prisma.portalSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
    req.portal = { phone: p.phone, sessionId: Number(s.id), tenantIds: (await tenantIdsFor(p.phone)).map((t) => Number(t.id)) };
    next();
  } catch (e) {
    next(e);
  }
};

/** Run `fn` with a tenant as the audit actor (portal actions are logged like staff ones). */
export const asTenant = <T>(req: Request, orgId: number, tenantId: number, fn: () => Promise<T>) =>
  actorStore.run({ orgId, tenantId, ip: req.ip, userAgent: req.get("user-agent") }, fn);

export const portalAuthRouter = Router();
portalAuthRouter.use(portalAuthRateLimiter);

const NEUTRAL = "If this number is registered with a landlord on RentHub, a code was sent to it.";

portalAuthRouter.post("/request-otp", validate(requestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { phone, lang } = req.body as z.infer<typeof requestSchema>;
  const recent = await prisma.portalOtp.findMany({ where: { phone, createdAt: { gt: new Date(Date.now() - 60 * MIN) } }, select: { createdAt: true } });
  const wait = otpThrottle(recent.map((r) => r.createdAt), new Date());
  if (wait) throw new TooManyRequestsError(`Please wait ${wait} seconds before asking for another code`);

  const tenants = await tenantIdsFor(phone);
  if (tenants.length) {
    const code = generateOtp(6);
    await prisma.portalOtp.create({ data: { phone, codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + OTP_MINUTES * MIN) } });
    // straight to the gateway: the outbox is per landlord and up to a minute late
    const r = await sendSms(phone, otpText(code, lang ?? tenants[0].lang));
    if (!r.ok) console.error(`[portal] OTP SMS to ${phone} failed: ${r.error}`);
  }
  sendResult(res, { message: NEUTRAL }, 200, NEUTRAL);
}));

portalAuthRouter.post("/verify-otp", validate(verifySchema), asyncHandler(async (req: Request, res: Response) => {
  const { phone, code } = req.body as z.infer<typeof verifySchema>;
  const otp = await prisma.portalOtp.findFirst({ where: { phone, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.attempts >= MAX_TRIES) throw new ValidationError("The code has expired or was tried too many times. Ask for a new code.");
  if (!(await bcrypt.compare(code, otp.codeHash))) {
    await prisma.portalOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_TRIES - otp.attempts - 1;
    throw new ValidationError(left > 0 ? `Wrong code. ${left} tries left.` : "Wrong code. Ask for a new code.");
  }
  // keep the rows for the hourly throttle, but burn them for login
  await prisma.portalOtp.updateMany({ where: { phone }, data: { attempts: MAX_TRIES, expiresAt: new Date() } });
  if (!(await tenantIdsFor(phone)).length) throw new UnauthorizedError("This number has no active tenancy");
  const { refreshToken, ...session } = await openSession(phone, req.get("user-agent"));
  setRefreshCookie(res, PORTAL_RT, refreshToken, SESSION_DAYS * 86_400_000);
  sendResult(res, session);
}));

/** The refresh token is the httpOnly cookie set at verify-otp; it rotates on every refresh. */
portalAuthRouter.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const token = readCookie(req, PORTAL_RT.name);
  const s = token ? await prisma.portalSession.findUnique({ where: { refreshHash: sha256(token) } }) : null;
  if (!s || s.expiresAt < new Date()) {
    clearRefreshCookie(res, PORTAL_RT);
    throw new UnauthorizedError("Session ended, please log in again");
  }
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  await prisma.portalSession.update({ where: { id: s.id }, data: { refreshHash: sha256(refreshToken), lastSeenAt: new Date() } });
  setRefreshCookie(res, PORTAL_RT, refreshToken, s.expiresAt.getTime() - Date.now());
  sendResult(res, { accessToken: generatePortalAccessToken({ phone: s.phone, sid: String(s.id) }), phone: s.phone });
}));

/** Ends this device's session (found by the cookie, so it works even with an expired access token). */
portalAuthRouter.post("/logout", asyncHandler(async (req: Request, res: Response) => {
  const token = readCookie(req, PORTAL_RT.name);
  if (token) await prisma.portalSession.deleteMany({ where: { refreshHash: sha256(token) } });
  clearRefreshCookie(res, PORTAL_RT);
  sendResult(res, { ok: true });
}));
