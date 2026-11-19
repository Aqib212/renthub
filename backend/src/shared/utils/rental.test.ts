import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargeFor, depositBalance, monthPeriod, rateFor, ruleWarnings, settle, utcDate } from "./rental";
import { sameAfterHeader } from "./billing.test";

const monthly = (start: Date, end?: Date) => ({ cycle: "MONTHLY" as const, rate: 15000, startDate: start, endDate: end ?? null });
const dec = monthPeriod(12, 2026);

test("monthPeriod covers the calendar month", () => {
  assert.equal(dec.start.toISOString().slice(0, 10), "2026-12-01");
  assert.equal(dec.end.toISOString().slice(0, 10), "2026-12-31");
  assert.equal(monthPeriod(2, 2028).end.toISOString().slice(0, 10), "2028-02-29"); // leap year
});

test("full month charges the full rate", () => {
  assert.equal(chargeFor(monthly(utcDate(2024, 1, 1)), [], dec)!.amount, 15000);
});

test("moving in on the 18th pro-rates by day", () => {
  const c = chargeFor(monthly(utcDate(2026, 12, 18)), [], dec)!;
  assert.equal(c.days, 14);
  assert.equal(c.amount, Math.round((15000 * 14) / 31 * 100) / 100); // 6774.19
  assert.ok(c.prorated);
});

test("moving out mid-month pro-rates the last month; outside the agreement is null", () => {
  const a = monthly(utcDate(2024, 1, 1), utcDate(2026, 12, 15));
  assert.equal(chargeFor(a, [], dec)!.days, 15);
  assert.equal(chargeFor(a, [], monthPeriod(1, 2027)), null);
  assert.equal(chargeFor(monthly(utcDate(2027, 1, 1)), [], dec), null);
});

test("rate revisions apply from their effective date", () => {
  const revs = [{ effectiveFrom: utcDate(2026, 7, 1), rate: 16500 }, { effectiveFrom: utcDate(2024, 7, 1), rate: 15500 }];
  assert.equal(rateFor(monthly(utcDate(2024, 1, 1)), revs, utcDate(2026, 6, 30)), 15500);
  assert.equal(chargeFor(monthly(utcDate(2024, 1, 1)), revs, dec)!.amount, 16500);
});

test("daily and trip cycles are not implemented yet", () => {
  assert.throws(() => chargeFor({ ...monthly(utcDate(2026, 1, 1)), cycle: "DAILY" }, [], dec), /not implemented/);
  assert.throws(() => chargeFor({ ...monthly(utcDate(2026, 1, 1)), cycle: "TRIP" }, [], dec), /not implemented/);
});

test("deposit ledger balance and move-out settlement", () => {
  const bal = depositBalance([
    { type: "RECEIVED", amount: 30000 },
    { type: "ADJUSTED", amount: 5000 },
    { type: "DEDUCTED_DAMAGE", amount: 2000 },
  ]);
  assert.equal(bal, 23000);
  assert.deepEqual(settle({ finalDues: 8000, depositBalance: 30000, deductions: 3000 }), { refund: 19000, due: 0, adjusted: 8000 });
  assert.deepEqual(settle({ finalDues: 40000, depositBalance: 30000, deductions: 0 }), { refund: 0, due: 10000, adjusted: 30000 });
});

test("rule warnings (never blocking)", () => {
  assert.equal(ruleWarnings({ rate: 15000, depositReceived: 45000 }).length, 0);
  assert.match(ruleWarnings({ rate: 15000, depositReceived: 60000 })[0], /3 months/);
  // increase in March, one year after the start: both rules
  const w = ruleWarnings({ rate: 15000, startDate: utcDate(2026, 3, 1), newRevision: { effectiveFrom: utcDate(2027, 3, 1), rate: 16000 } });
  assert.equal(w.length, 2);
  // increase in July after 2 years: fine
  assert.equal(ruleWarnings({ rate: 15000, startDate: utcDate(2024, 7, 1), newRevision: { effectiveFrom: utcDate(2026, 7, 1), rate: 16000 } }).length, 0);
  assert.match(ruleWarnings({ rate: 30000, bankOnly: true, paymentMethod: "CASH" })[0], /bank/);
  assert.equal(ruleWarnings({ rate: 30000, bankOnly: true, paymentMethod: "BANK" }).length, 0);
  assert.match(ruleWarnings({ rate: 1, noticeDate: utcDate(2026, 12, 1), endDate: utcDate(2026, 12, 31), noticeDays: 60 })[0], /notice/);
});

test("frontend rental.ts is identical to backend (after the header line)", () => {
  const backend = readFileSync(join(__dirname, "rental.ts"), "utf8");
  const frontend = readFileSync(join(__dirname, "../../../../frontend/src/utils/rental.ts"), "utf8");
  assert.ok(sameAfterHeader(backend, frontend), "frontend/src/utils/rental.ts differs from backend/src/shared/utils/rental.ts");
});
