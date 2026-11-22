import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "fallback-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },

  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || "10", 10),
  },

  /** Public base URL of the frontend, used in SMS links (receipts, invoices). */
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),

  /** Where the payment gateway sends the browser and its IPN back to; the frontend proxies /api, so APP_URL works locally. */
  apiPublicUrl: (process.env.API_PUBLIC_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),

  gateway: {
    /** encrypts each workspace's SSLCommerz store password at rest (any long random string) */
    key: process.env.GATEWAY_KEY || "",
    /** test mode only: skip SSLCommerz and accept val_id "FAKE-<tranId>" */
    fake: process.env.SSLCZ_FAKE === "1" && process.env.NODE_ENV !== "production",
  },

  sms: {
    /** "console" prints messages (default); "http" calls a gateway with the template URL below. */
    driver: (process.env.SMS_DRIVER || "console") as "console" | "http",
    /** e.g. https://gateway.example/api?api_key={key}&senderid={sender}&number={to}&message={text} */
    httpUrl: process.env.SMS_HTTP_URL || "",
    apiKey: process.env.SMS_API_KEY || "",
    senderId: process.env.SMS_SENDER_ID || "",
    /** substring that marks success in the gateway response; empty = any HTTP 2xx */
    okMatch: process.env.SMS_HTTP_OK || "",
  },
} as const;
