// Late fee rule (pure). Applied once per invoice by the nightly cron; the fee lives in Invoice.fine.

export interface LateFeeSettings { enabled: boolean; afterDays: number; type: "FLAT" | "PERCENT"; amount: number }
export const DEFAULT_LATE_FEE: LateFeeSettings = { enabled: false, afterDays: 5, type: "FLAT", amount: 0 };

export interface LateFeeInvoice {
  dueDate: Date | null;
  dueAmount: number;
  fine: number;
  rent: number;
  carriedForward: boolean;
  /** the agreement's cycle; null for invoices with no agreement (rent-a-car trips) */
  cycle: string | null;
}

const DAY = 86_400_000;

/** The fee to add today, or 0: off, already fined (or fined by hand), paid, carried, not MONTHLY, or still in grace. */
export function lateFeeFor(inv: LateFeeInvoice, s: LateFeeSettings, today: Date) {
  if (!s.enabled || s.amount <= 0) return 0;
  if (inv.cycle !== "MONTHLY" || inv.carriedForward || inv.fine > 0 || inv.dueAmount <= 0 || !inv.dueDate) return 0;
  if (today.getTime() < inv.dueDate.getTime() + s.afterDays * DAY) return 0;
  return s.type === "PERCENT" ? Math.round((inv.rent * s.amount) / 100) : Math.round(s.amount);
}
