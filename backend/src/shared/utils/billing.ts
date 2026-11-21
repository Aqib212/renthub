// Pure bill calculation. Keep in sync with frontend/src/utils/billing.ts (same code, copied).

export type CalcMethod = "FIXED" | "METERED" | "SLAB" | "PER_PERSON" | "MANUAL" | "SHARED";

export interface SlabStep { from: number; to: number | null; rate: number }
export interface Slabs { steps: SlabStep[]; lifeline?: { upTo: number; rate: number } | null }

export interface BillTypeCalc {
  name: string;
  calcMethod: CalcMethod;
  rate?: number | null;
  unitLabel?: string | null;
  slabs?: Slabs | null;
  fixedCharge?: number | null;
  demandChargePerKw?: number | null;
  vatPercent?: number | null;
}

export interface EntryCalc {
  previousReading?: number | null;
  currentReading?: number | null;
  units?: number | null;
  amount?: number | null;
}

export interface ChargeContext {
  override?: number | null; // FlatCharge.amount
  entry?: EntryCalc | null;
  members?: number;
  loadKw?: number | null;
}

export interface ChargeResult { amount: number; quantity: number | null; rate: number | null; detail: string }

const r2 = (n: number) => Math.round(n * 100) / 100;
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

// BERC LT-A residential tariff (June 2026), source: ebill.info.bd
export const BERC_RESIDENTIAL: { slabs: Slabs; demandChargePerKw: number; vatPercent: number } = {
  slabs: {
    lifeline: { upTo: 50, rate: 4.63 },
    steps: [
      { from: 1, to: 75, rate: 5.26 },
      { from: 76, to: 200, rate: 8.5 },
      { from: 201, to: 300, rate: 9.1 },
      { from: 301, to: 400, rate: 9.62 },
      { from: 401, to: 600, rate: 15.01 },
      { from: 601, to: null, rate: 17.35 },
    ],
  },
  demandChargePerKw: 42,
  vatPercent: 5,
};

export function entryUnits(entry?: EntryCalc | null): number | null {
  if (!entry) return null;
  const cur = n(entry.currentReading);
  const prev = n(entry.previousReading);
  if (cur !== null && prev !== null) return Math.max(0, cur - prev);
  return n(entry.units);
}

export function slabEnergy(units: number, slabs: Slabs): number {
  if (slabs.lifeline && units <= slabs.lifeline.upTo) return units * slabs.lifeline.rate;
  let total = 0;
  for (const s of slabs.steps) {
    const lo = s.from - 1;
    const hi = s.to ?? Infinity;
    if (units <= lo) break;
    total += (Math.min(units, hi) - lo) * s.rate;
  }
  return total;
}

/** Amount one flat owes for one bill type in one month. null = nothing to bill (e.g. reading not entered yet). */
export function calcCharge(bt: BillTypeCalc, ctx: ChargeContext = {}): ChargeResult | null {
  const vat = n(bt.vatPercent) ?? 0;
  const fixed = n(bt.fixedCharge) ?? 0;
  const rate = n(ctx.override) ?? n(bt.rate) ?? 0;
  const unit = bt.unitLabel || "unit";
  const typed = n(ctx.entry?.amount);

  let base: number;
  let quantity: number | null = null;
  let detail: string;

  if (typed !== null) {
    // An amount typed for this month always wins (MANUAL, or a correction on any type)
    return { amount: r2(typed), quantity: null, rate: null, detail: "Entered amount" };
  }

  switch (bt.calcMethod) {
    case "MANUAL":
      return null;
    case "FIXED":
      base = rate;
      detail = "Monthly charge";
      break;
    case "PER_PERSON": {
      quantity = ctx.members ?? 1;
      base = rate * quantity;
      detail = `${quantity} person × ৳${rate}`;
      break;
    }
    case "METERED":
    case "SLAB": {
      const units = entryUnits(ctx.entry);
      if (units === null) return null;
      quantity = units;
      const reading = ctx.entry?.currentReading != null && ctx.entry?.previousReading != null
        ? `${Number(ctx.entry.previousReading)} → ${Number(ctx.entry.currentReading)} = ` : "";
      if (bt.calcMethod === "METERED") {
        base = units * rate;
        detail = `${reading}${units} ${unit} × ৳${rate}`;
      } else {
        const energy = bt.slabs ? slabEnergy(units, bt.slabs) : 0;
        const demand = (n(ctx.loadKw) ?? 0) * (n(bt.demandChargePerKw) ?? 0);
        base = energy + demand;
        detail = `${reading}${units} ${unit} · energy ৳${r2(energy)}` + (demand ? ` + demand ৳${r2(demand)}` : "");
      }
      if (fixed) detail += ` + meter ৳${fixed}`;
      base += fixed;
      break;
    }
    default:
      return null;
  }

  const total = base * (1 + vat / 100);
  if (vat) detail += ` + VAT ${vat}%`;
  return { amount: r2(total), quantity, rate: bt.calcMethod === "SLAB" ? null : rate, detail };
}

export type SplitRule = "EQUAL" | "PER_PERSON" | "PER_SQFT";

/**
 * Split a building bill by weight (1 each for EQUAL, people for PER_PERSON, sq ft for PER_SQFT).
 * Whole taka per share; the rounding remainder goes on the last share so shares add up to the total.
 */
export function splitShares(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!weights.length || sum <= 0) throw new Error("Nothing to split the bill across");
  const shares = weights.map((w) => Math.round((total * w) / sum));
  shares[shares.length - 1] = r2(total - shares.slice(0, -1).reduce((s, x) => s + x, 0));
  return shares;
}
