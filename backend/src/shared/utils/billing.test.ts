import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcCharge, slabEnergy, BERC_RESIDENTIAL } from "./billing";

const elec = { name: "Electricity", calcMethod: "SLAB" as const, unitLabel: "kWh", ...BERC_RESIDENTIAL };

test("slab tariff (BERC)", () => {
  // ebill.info.bd worked example: 200 units, 1 kW -> ৳1,573.95
  assert.equal(calcCharge(elec, { entry: { previousReading: 1000, currentReading: 1200 }, loadKw: 1 })!.amount, 1573.95);
  // lifeline: 50 units all at 4.63; 51 units jumps to stepped rates
  assert.equal(slabEnergy(50, elec.slabs), 231.5);
  assert.equal(Math.round(slabEnergy(51, elec.slabs) * 100) / 100, 268.26);
  // open-ended top slab
  assert.equal(Math.round(slabEnergy(700, elec.slabs) * 100) / 100, 394.5 + 1062.5 + 910 + 962 + 3002 + 1735);
  // no reading yet -> nothing billed
  assert.equal(calcCharge(elec, {}), null);
});

test("fixed, metered, per person, manual", () => {
  assert.equal(calcCharge({ name: "Lift", calcMethod: "FIXED", rate: 500 })!.amount, 500);
  assert.equal(calcCharge({ name: "Garage", calcMethod: "FIXED", rate: 1500 }, { override: 2000 })!.amount, 2000);
  assert.equal(calcCharge({ name: "Gas", calcMethod: "METERED", rate: 20, fixedCharge: 100, vatPercent: 5 },
    { entry: { units: 30 } })!.amount, 735);
  assert.equal(calcCharge({ name: "Water", calcMethod: "PER_PERSON", rate: 150 }, { members: 4 })!.amount, 600);
  assert.equal(calcCharge({ name: "Repair", calcMethod: "MANUAL" }, {}), null);
  assert.equal(calcCharge({ name: "Repair", calcMethod: "MANUAL" }, { entry: { amount: 1250 } })!.amount, 1250);
});

// The calculator is copied into the frontend; fail if the copies drift.
// ponytail: copy + guard; move to a shared workspace package if a third copy appears.
export function sameAfterHeader(a: string, b: string) {
  const body = (s: string) => s.replace(/\r\n/g, "\n").split("\n").slice(1).join("\n");
  return body(a) === body(b);
}

test("frontend billing.ts is identical to backend (after the header line)", () => {
  const backend = readFileSync(join(__dirname, "billing.ts"), "utf8");
  const frontend = readFileSync(join(__dirname, "../../../../frontend/src/utils/billing.ts"), "utf8");
  assert.ok(sameAfterHeader(backend, frontend), "frontend/src/utils/billing.ts differs from backend/src/shared/utils/billing.ts");
});
