import { test } from "node:test";
import assert from "node:assert/strict";
import { lateFeeFor, type LateFeeInvoice } from "./lateFee";

const inv: LateFeeInvoice = { dueDate: new Date("2026-12-10T00:00:00Z"), dueAmount: 25000, fine: 0, rent: 25000, carriedForward: false, cycle: "MONTHLY" };
const flat = { enabled: true, afterDays: 5, type: "FLAT" as const, amount: 500 };
const day = (s: string) => new Date(`${s}T01:00:00Z`);

test("late fee: flat after the grace days, not before", () => {
  assert.equal(lateFeeFor(inv, flat, day("2026-12-14")), 0);
  assert.equal(lateFeeFor(inv, flat, day("2026-12-15")), 500);
});

test("late fee: percent of the rent, rounded to the taka", () => {
  assert.equal(lateFeeFor({ ...inv, rent: 23333 }, { ...flat, type: "PERCENT", amount: 2 }, day("2026-12-20")), 467);
});

test("late fee: only once, never when off, paid, carried, jama or trip", () => {
  const late = day("2026-12-31");
  assert.equal(lateFeeFor({ ...inv, fine: 500 }, flat, late), 0);
  assert.equal(lateFeeFor(inv, { ...flat, enabled: false }, late), 0);
  assert.equal(lateFeeFor({ ...inv, dueAmount: 0 }, flat, late), 0);
  assert.equal(lateFeeFor({ ...inv, carriedForward: true }, flat, late), 0);
  assert.equal(lateFeeFor({ ...inv, cycle: "DAILY" }, flat, late), 0);
  assert.equal(lateFeeFor({ ...inv, cycle: null }, flat, late), 0);
  assert.equal(lateFeeFor({ ...inv, dueDate: null }, flat, late), 0);
});
