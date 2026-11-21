import type { CalcMethod, Slabs, ChargeResult, SplitRule } from "@/utils/billing";

export type { CalcMethod, Slabs, SplitRule };

export interface BillType {
  id: number;
  name: string;
  calcMethod: CalcMethod;
  rate: number | null;
  unitLabel: string | null;
  slabs: Slabs | null;
  fixedCharge: number | null;
  demandChargePerKw: number | null;
  vatPercent: number | null;
  split?: SplitRule | null;
  appliesToAll: boolean;
  isActive: boolean;
  sortOrder: number;
  _count?: { flatCharges: number };
}

export type BillTypeInput = Omit<BillType, "id" | "_count">;

export interface FlatChargeRow {
  flatId: number;
  flatName: string;
  buildingName: string;
  tenantName: string | null;
  isActive: boolean;
  amount: number | null;
}

export interface EntryValues {
  previousReading: number | null;
  currentReading: number | null;
  units: number | null;
  amount: number | null;
  note?: string | null;
}

export interface BillingCharge {
  billTypeId: number;
  applies: boolean;
  override: number | null;
  lastReading: number | null;
  entry: EntryValues | null;
  result: ChargeResult | null;
}

export interface BillingRow {
  flatId: number;
  flatName: string;
  flatNumber: string | null;
  buildingName: string;
  rent: number;
  sanctionedLoad: number | null;
  tenantName: string | null;
  members: number;
  invoice: { id: number; status: string; totalAmount: number } | null;
  charges: BillingCharge[];
}

export interface BuildingBill {
  id: number;
  buildingId: number;
  billTypeId: number;
  month: number;
  year: number;
  total: number;
  note: string | null;
}

export interface BillingMonth {
  billTypes: BillType[];
  buildingBills: BuildingBill[];
  rows: BillingRow[];
}

export const CALC_METHODS: { value: CalcMethod; label: string; help: string }[] = [
  { value: "FIXED", label: "Fixed monthly", help: "Same amount every month (service charge, lift, security, garage)" },
  { value: "METERED", label: "Metered", help: "Units used × rate, plus meter rent and VAT (water or gas meter)" },
  { value: "SLAB", label: "Slab tariff", help: "Stepped rates by units, plus demand charge and VAT (electricity)" },
  { value: "PER_PERSON", label: "Per person", help: "Rate × number of people in the flat (water per head)" },
  { value: "MANUAL", label: "Enter each month", help: "Type the amount every month (repairs, one-off charges)" },
  { value: "SHARED", label: "Shared building bill", help: "One bill for the building split across the units (WASA, common electricity, guards)" },
];

export const SPLIT_RULES: { value: SplitRule; label: string }[] = [
  { value: "EQUAL", label: "Equally between units" },
  { value: "PER_PERSON", label: "By number of people" },
  { value: "PER_SQFT", label: "By size (sq ft)" },
];

export const methodLabel = (m: CalcMethod) => CALC_METHODS.find((c) => c.value === m)?.label ?? m;
