// Document expiry rules (pure). Reminders go out 30 and 7 days before, and on the day.
const DAY = 86_400_000;

export const daysLeft = (expiresAt: Date, today: Date) =>
  Math.round((Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth(), expiresAt.getUTCDate()) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / DAY);

export const REMINDER_STAGES = [30, 7, 0] as const;

/** Which reminder is due today, if any. */
export function expiryStage(expiresAt: Date, today: Date): (typeof REMINDER_STAGES)[number] | null {
  const left = daysLeft(expiresAt, today);
  return (REMINDER_STAGES as readonly number[]).includes(left) ? (left as 30 | 7 | 0) : null;
}

interface Expiring {
  kind: string;
  expiresAt: Date | null;
  tenantId?: bigint | number | null;
  assetId?: bigint | number | null;
  agreementId?: bigint | number | null;
}

/**
 * Renewing a document is uploading the new one: for each kind on the same tenant/vehicle/agreement
 * only the document that expires last counts, the older ones are superseded.
 */
export function currentDocs<T extends Expiring>(docs: T[]): T[] {
  const best = new Map<string, T>();
  for (const d of docs) {
    if (!d.expiresAt) continue;
    const key = `${d.kind}|${d.tenantId ?? ""}|${d.assetId ?? ""}|${d.agreementId ?? ""}`;
    const cur = best.get(key);
    if (!cur || d.expiresAt > cur.expiresAt!) best.set(key, d);
  }
  return [...best.values()];
}
