/**
 * Bangladeshi mobile numbers -> the 8801XXXXXXXXX form SMS gateways expect, or null if not a mobile number.
 * Accepts 01XXXXXXXXX, 8801…, +8801…, with spaces or dashes. Operators use 013–019.
 */
export function normalizeBdPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("880") ? "0" + digits.slice(3) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? "88" + local : null;
}
