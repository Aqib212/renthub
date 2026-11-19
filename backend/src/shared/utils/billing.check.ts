// Run: npx tsx src/shared/utils/billing.check.ts
import assert from "node:assert/strict";
import { calcCharge, slabEnergy, BERC_RESIDENTIAL } from "./billing";

const elec = { name: "Electricity", calcMethod: "SLAB" as const, unitLabel: "kWh", ...BERC_RESIDENTIAL };

// ebill.info.bd worked example: 200 units, 1 kW -> ৳1,573.95
assert.equal(calcCharge(elec, { entry: { previousReading: 1000, currentReading: 1200 }, loadKw: 1 })!.amount, 1573.95);
// lifeline: 50 units all at 4.63; 51 units jumps to stepped rates
assert.equal(slabEnergy(50, elec.slabs), 231.5);
assert.equal(Math.round(slabEnergy(51, elec.slabs) * 100) / 100, 268.26);
// open-ended top slab
assert.equal(Math.round(slabEnergy(700, elec.slabs) * 100) / 100, 394.5 + 1062.5 + 910 + 962 + 3002 + 1735);
// no reading yet -> nothing billed
assert.equal(calcCharge(elec, {}), null);

assert.equal(calcCharge({ name: "Lift", calcMethod: "FIXED", rate: 500 })!.amount, 500);
assert.equal(calcCharge({ name: "Garage", calcMethod: "FIXED", rate: 1500 }, { override: 2000 })!.amount, 2000);
assert.equal(calcCharge({ name: "Gas", calcMethod: "METERED", rate: 20, fixedCharge: 100, vatPercent: 5 },
  { entry: { units: 30 } })!.amount, 735);
assert.equal(calcCharge({ name: "Water", calcMethod: "PER_PERSON", rate: 150 }, { members: 4 })!.amount, 600);
assert.equal(calcCharge({ name: "Repair", calcMethod: "MANUAL" }, {}), null);
assert.equal(calcCharge({ name: "Repair", calcMethod: "MANUAL" }, { entry: { amount: 1250 } })!.amount, 1250);

console.log("billing checks passed");
