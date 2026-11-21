import { test } from "node:test";
import assert from "node:assert/strict";
import { splitShares } from "./billing";
import { fiscalYearRange, monthPeriod, utcDate, vacantDays } from "./rental";

test("splitShares: equal, weighted, remainder on the last share", () => {
  assert.deepEqual(splitShares(12000, [1, 1, 1, 1, 1, 1]), [2000, 2000, 2000, 2000, 2000, 2000]);
  assert.deepEqual(splitShares(1000, [1, 1, 1]), [333, 333, 334]);
  assert.deepEqual(splitShares(9000, [2, 4, 3]), [2000, 4000, 3000]); // per person
  const sqft = splitShares(10000.5, [1200, 950, 1400]);
  assert.equal(sqft.reduce((s, x) => s + x, 0), 10000.5);
  assert.throws(() => splitShares(500, []));
  assert.throws(() => splitShares(500, [0, 0]));
});

test("fiscalYearRange: 1 July to 30 June", () => {
  const fy = fiscalYearRange(2026);
  assert.deepEqual(fy.start, utcDate(2026, 7, 1));
  assert.deepEqual(fy.end, utcDate(2027, 6, 30));
});

test("vacantDays", () => {
  const nov = monthPeriod(11, 2026); // 30 days
  assert.equal(vacantDays(nov, []), 30);
  assert.equal(vacantDays(nov, [{ startDate: utcDate(2026, 11, 11) }]), 10); // moved in on the 11th
  assert.equal(vacantDays(nov, [{ startDate: utcDate(2025, 1, 1), endDate: utcDate(2026, 11, 20) }]), 10); // left on the 20th
  assert.equal(
    vacantDays(nov, [
      { startDate: utcDate(2025, 1, 1), endDate: utcDate(2026, 11, 10) },
      { startDate: utcDate(2026, 11, 16), endDate: null },
    ]),
    5
  );
  assert.equal(vacantDays(nov, [{ startDate: utcDate(2027, 1, 1) }]), 30); // starts later
});
