// Pure rental rules. Copy of backend/src/shared/utils/rental.ts — keep both identical (a backend test checks).
// frontend/src/utils/rental.ts (a test fails if the copies drift). Dates are UTC midnight (Prisma @db.Date).

export type Cycle = "MONTHLY" | "DAILY" | "WEEKLY" | "TRIP";

export interface AgreementTerms {
  cycle: Cycle;
  rate: number;
  startDate: Date;
  endDate?: Date | null;
}
export interface Revision { effectiveFrom: Date; rate: number }
export interface Period { start: Date; end: Date } // both inclusive
export interface DepositLine { type: "RECEIVED" | "ADJUSTED" | "DEDUCTED_DAMAGE" | "REFUNDED"; amount: number }

const DAY = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY) + 1; // inclusive

/** Calendar month as a period, e.g. (12, 2026) -> 1–31 Dec 2026. */
export const monthPeriod = (month: number, year: number): Period => ({
  start: utcDate(year, month, 1),
  end: utcDate(year, month + 1, 0),
});

/** Rate in force on `on`: the latest revision that has started, else the agreement rate. */
export function rateFor(a: AgreementTerms, revisions: Revision[], on: Date) {
  const r = revisions
    .filter((x) => x.effectiveFrom.getTime() <= on.getTime())
    .sort((x, y) => y.effectiveFrom.getTime() - x.effectiveFrom.getTime())[0];
  return r ? r.rate : a.rate;
}

/**
 * The main charge (rent) of one period, or null when the agreement does not cover it.
 * MONTHLY: full rate for a full month; pro-rated by day for the first and last month.
 * ponytail: a revision taking effect mid-month applies from the next period; split by day if owners ask.
 */
export function chargeFor(a: AgreementTerms, revisions: Revision[], period: Period) {
  if (a.cycle !== "MONTHLY") throw new Error(`${a.cycle} billing is not implemented yet (phase 6-7)`);
  const from = new Date(Math.max(a.startDate.getTime(), period.start.getTime()));
  const to = new Date(Math.min((a.endDate ?? period.end).getTime(), period.end.getTime()));
  if (from > to) return null;
  const rate = rateFor(a, revisions, from);
  const days = daysBetween(from, to);
  const monthDays = daysBetween(period.start, period.end);
  const full = days === monthDays;
  return {
    amount: full ? rate : r2((rate * days) / monthDays),
    rate,
    days,
    monthDays,
    prorated: !full,
    from,
    to,
  };
}

export function depositBalance(entries: DepositLine[]) {
  return r2(entries.reduce((s, e) => s + (e.type === "RECEIVED" ? e.amount : -e.amount), 0));
}

/** Move-out: deposit pays the final dues and deductions; the rest is refunded, or the tenant still owes. */
export function settle({ finalDues, depositBalance: held, deductions }: { finalDues: number; depositBalance: number; deductions: number }) {
  const net = r2(held - deductions - finalDues);
  return net >= 0 ? { refund: net, due: 0, adjusted: r2(Math.min(held, finalDues)) } : { refund: 0, due: -net, adjusted: r2(Math.min(held, finalDues)) };
}

/** Bangladesh rent rules (DNCC guideline, Rent Act, NBR). They warn; they never block. */
export interface RuleInput {
  rate: number;
  depositReceived?: number;
  revisions?: Revision[];
  startDate?: Date;
  newRevision?: Revision;
  bankOnly?: boolean;
  paymentMethod?: string;
  noticeDate?: Date;
  endDate?: Date;
  noticeDays?: number;
}

export function ruleWarnings(i: RuleInput): string[] {
  const w: string[] = [];
  if (i.depositReceived && i.rate > 0 && i.depositReceived > 3 * i.rate) {
    w.push("Deposit is more than 3 months' rent (DNCC guidance allows 1–3; the Rent Act allows 1).");
  }
  if (i.newRevision) {
    const m = i.newRevision.effectiveFrom.getUTCMonth() + 1;
    if (m !== 6 && m !== 7) w.push("Rent increases are expected in June–July (DNCC).");
    const last = [...(i.revisions ?? [])].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0]?.effectiveFrom ?? i.startDate;
    if (last && i.newRevision.effectiveFrom.getTime() - last.getTime() < 2 * 365 * DAY && i.newRevision.rate > i.rate) {
      w.push("Rent was set less than 2 years ago; DNCC allows one increase every 2 years.");
    }
  }
  if (i.bankOnly && i.paymentMethod === "CASH") w.push("Rent above ৳25,000 a month should be paid through a bank (NBR).");
  if (i.noticeDate && i.endDate && i.noticeDays && daysBetween(i.noticeDate, i.endDate) - 1 < i.noticeDays) {
    w.push(`Less than ${Math.round(i.noticeDays / 30)} months' notice.`);
  }
  return w;
}
