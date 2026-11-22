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

export interface DayOverride { date: Date; amount: number }

/**
 * The main charge (rent / jama) of one period, or null when the agreement does not cover it.
 * MONTHLY: full rate for a full month; pro-rated by day for the first and last month.
 * ponytail: a revision taking effect mid-month applies from the next period; split by day if owners ask.
 * DAILY: each covered day costs the rate in force that day, unless `days` overrides it (0 = off day).
 */
export function chargeFor(a: AgreementTerms, revisions: Revision[], period: Period, days: DayOverride[] = []) {
  if (a.cycle !== "MONTHLY" && a.cycle !== "DAILY") throw new Error(`${a.cycle} billing is not implemented yet (phase 7)`);
  const from = new Date(Math.max(a.startDate.getTime(), period.start.getTime()));
  const to = new Date(Math.min((a.endDate ?? period.end).getTime(), period.end.getTime()));
  if (from > to) return null;
  const rate = rateFor(a, revisions, from);
  const covered = daysBetween(from, to);
  const monthDays = daysBetween(period.start, period.end);
  const prorated = covered !== monthDays;
  if (a.cycle === "DAILY") {
    const over = new Map(days.map((d) => [d.date.getTime(), d.amount]));
    let amount = 0;
    let offDays = 0;
    for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
      const o = over.get(t);
      if (o === undefined) amount += rateFor(a, revisions, new Date(t));
      else {
        amount += o;
        if (o === 0) offDays++;
      }
    }
    return { amount: r2(amount), rate, days: covered, monthDays, offDays, prorated, from, to };
  }
  return { amount: prorated ? r2((rate * covered) / monthDays) : rate, rate, days: covered, monthDays, offDays: 0, prorated, from, to };
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
  /** vehicles skip the house rules (DNCC deposit and increase limits) */
  kind?: "UNIT" | "VEHICLE";
}

export function ruleWarnings(i: RuleInput): string[] {
  const w: string[] = [];
  const house = i.kind !== "VEHICLE";
  if (house && i.depositReceived && i.rate > 0 && i.depositReceived > 3 * i.rate) {
    w.push("Deposit is more than 3 months' rent (DNCC guidance allows 1–3; the Rent Act allows 1).");
  }
  if (house && i.newRevision) {
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

/** Bangladesh income year: 1 July `fy` to 30 June `fy + 1`. */
export const fiscalYearRange = (fy: number): Period => ({ start: utcDate(fy, 7, 1), end: utcDate(fy + 1, 6, 30) });

/** Days of `period` covered by no agreement (agreements given as start/end, end null = open). */
export function vacantDays(period: Period, agreements: { startDate: Date; endDate?: Date | null }[]) {
  const covered = new Set<number>();
  for (const a of agreements) {
    const from = Math.max(a.startDate.getTime(), period.start.getTime());
    const to = Math.min((a.endDate ?? period.end).getTime(), period.end.getTime());
    for (let t = from; t <= to; t += DAY) covered.add(t);
  }
  return daysBetween(period.start, period.end) - covered.size;
}

/** Rent-a-car booking terms and trip sheet (times are real instants, not UTC midnights). */
export interface TripInput {
  startAt: Date;
  endAt: Date;
  /** actual times from the trip sheet; they win over the planned ones */
  startedAt?: Date | null;
  endedAt?: Date | null;
  dayRate: number;
  hourCap: number;
  kmCap?: number | null;
  overtimeRate: number;
  extraKmRate: number;
  fuelPerKm: number;
  startKm?: number | null;
  endKm?: number | null;
  extras?: { label: string; amount: number }[] | null;
}
export interface TripLine { label: string; detail: string | null; quantity: number | null; rate: number | null; amount: number }

const BD = 6 * 3_600_000; // Bangladesh is UTC+6
const bdDay = (d: Date) => Math.floor((d.getTime() + BD) / DAY);

/**
 * The bill of one trip: body rent per Bangladesh calendar day (min 1), overtime, extra km, fuel and extras.
 * Days before the last are covered in full (outstation: the driver stays with the car); overtime is only
 * the last day's hours beyond `hourCap`. ponytail: per-day hour logs if owners need overtime on each day.
 * The km cap is pooled over the trip (days × kmCap).
 */
export function tripCharge(t: TripInput) {
  const start = t.startedAt ?? t.startAt;
  const end = t.endedAt ?? t.endAt;
  const days = Math.max(1, bdDay(end) - bdDay(start) + 1);
  const hours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
  const km = t.startKm != null && t.endKm != null ? Math.max(0, t.endKm - t.startKm) : null;
  const items: TripLine[] = [{ label: "Body rent", detail: `${days} day${days > 1 ? "s" : ""} × ৳${t.dayRate}`, quantity: days, rate: t.dayRate, amount: r2(days * t.dayRate) }];
  const otHours = Math.max(0, Math.ceil(hours - (days - 1) * 24 - t.hourCap));
  if (otHours && t.overtimeRate) items.push({ label: "Overtime", detail: `${otHours} h over ${t.hourCap} h`, quantity: otHours, rate: t.overtimeRate, amount: r2(otHours * t.overtimeRate) });
  if (km != null && t.kmCap && t.extraKmRate) {
    const extra = Math.max(0, km - days * t.kmCap);
    if (extra) items.push({ label: "Extra km", detail: `${extra} km over ${days * t.kmCap} km`, quantity: extra, rate: t.extraKmRate, amount: r2(extra * t.extraKmRate) });
  }
  if (km && t.fuelPerKm) items.push({ label: "Fuel", detail: `${km} km × ৳${t.fuelPerKm}`, quantity: km, rate: t.fuelPerKm, amount: r2(km * t.fuelPerKm) });
  for (const x of t.extras ?? []) if (x.amount) items.push({ label: x.label || "Extra", detail: null, quantity: null, rate: null, amount: r2(x.amount) });
  return { days, hours: r2(hours), km, items, total: r2(items.reduce((s, i) => s + i.amount, 0)) };
}

/** Two time windows overlap (touching ends do not). */
export const bookingClash = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
  a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
