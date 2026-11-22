import { env } from "../../config/env";

export interface SendResult { ok: boolean; error?: string }

/**
 * Sends one SMS. `console` (default) prints it, like OTPs. `http` fills SMS_HTTP_URL's
 * {to} {text} {sender} {key} placeholders: one generic driver for the usual BD gateway GET APIs.
 * ponytail: add a provider-specific driver only if a gateway needs a POST body or signed request.
 */
const BULKSMSBD = "http://bulksmsbd.net/api";
const BULK_ERRORS: Record<number, string> = {
  1001: "Invalid number",
  1002: "Sender ID is wrong or disabled",
  1003: "Missing fields",
  1005: "Gateway internal error",
  1006: "Gateway balance validity expired",
  1007: "Gateway balance is empty: top up the BulkSMSBD account",
  1011: "Unknown BulkSMSBD user",
  1012: "Masking SMS must be in Bangla",
  1013: "Sender ID not found for this API key",
  1018: "BulkSMSBD account disabled",
  1031: "BulkSMSBD account not verified",
  1032: "Server IP not whitelisted at BulkSMSBD",
};

/** BulkSMSBD answers HTTP 200 with a JSON response_code; 202 means submitted. */
export function bulkSmsResult(body: unknown): SendResult {
  const code = Number((body as { response_code?: unknown } | null)?.response_code);
  if (code === 202) return { ok: true };
  const msg = (body as { error_message?: string } | null)?.error_message;
  return { ok: false, error: `BulkSMSBD ${Number.isFinite(code) ? code : "?"}: ${BULK_ERRORS[code] ?? msg ?? "unexpected answer"}` };
}

async function sendBulkSmsBd(to: string, text: string): Promise<SendResult> {
  if (!env.sms.apiKey || !env.sms.senderId) return { ok: false, error: "SMS_API_KEY / SMS_SENDER_ID are not set" };
  try {
    // ponytail: type "text" covers Bangla on BulkSMSBD's current API; confirm with a live key before launch
    const body = new URLSearchParams({ api_key: env.sms.apiKey, senderid: env.sms.senderId, number: to, message: text, type: "text" });
    const res = await fetch(`${BULKSMSBD}/smsapi`, { method: "POST", body, signal: AbortSignal.timeout(15_000) });
    const json = await res.json().catch(() => null);
    return res.ok ? bulkSmsResult(json) : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The platform's BulkSMSBD balance in taka (super-admin screen); null when not on BulkSMSBD. */
export async function gatewayBalance(): Promise<{ driver: string; balance: number | null; error?: string }> {
  if (env.sms.driver !== "bulksmsbd") return { driver: env.sms.driver, balance: null };
  try {
    const res = await fetch(`${BULKSMSBD}/getBalanceApi?api_key=${encodeURIComponent(env.sms.apiKey)}`, { signal: AbortSignal.timeout(10_000) });
    const j = (await res.json().catch(() => null)) as { response_code?: number; balance?: number | string } | null;
    return j?.balance != null ? { driver: "bulksmsbd", balance: Number(j.balance) } : { driver: "bulksmsbd", balance: null, error: bulkSmsResult(j).error };
  } catch (e) {
    return { driver: "bulksmsbd", balance: null, error: (e as Error).message };
  }
}

export async function sendSms(to: string, text: string): Promise<SendResult> {
  if (env.sms.driver === "bulksmsbd") return sendBulkSmsBd(to, text);
  if (env.sms.driver !== "http") {
    console.log(`[SMS] to ${to}: ${text}`);
    return { ok: true };
  }
  if (!env.sms.httpUrl) return { ok: false, error: "SMS_HTTP_URL is not set" };
  const url = env.sms.httpUrl
    .replace("{to}", encodeURIComponent(to))
    .replace("{text}", encodeURIComponent(text))
    .replace("{sender}", encodeURIComponent(env.sms.senderId))
    .replace("{key}", encodeURIComponent(env.sms.apiKey));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    const ok = res.ok && (!env.sms.okMatch || body.includes(env.sms.okMatch));
    return ok ? { ok } : { ok, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
