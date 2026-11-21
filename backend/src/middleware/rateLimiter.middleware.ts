import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Portal login: tenants of one building often share an IP (same Wi-Fi), so allow more per IP;
 * each phone is still limited to 1 code a minute / 5 an hour and 5 tries per code (portal.auth.ts).
 */
export const portalAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many login attempts from this network, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
