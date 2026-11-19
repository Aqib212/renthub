import { env } from "../../config/env";

export interface SendResult { ok: boolean; error?: string }

/**
 * Sends one SMS. `console` (default) prints it, like OTPs. `http` fills SMS_HTTP_URL's
 * {to} {text} {sender} {key} placeholders: one generic driver for the usual BD gateway GET APIs.
 * ponytail: add a provider-specific driver only if a gateway needs a POST body or signed request.
 */
export async function sendSms(to: string, text: string): Promise<SendResult> {
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
