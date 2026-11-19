import { z } from "zod";

const money = z.number().min(0).nullable().optional();

const slabsSchema = z.object({
  steps: z.array(z.object({ from: z.number().min(0), to: z.number().min(0).nullable(), rate: z.number().min(0) })),
  lifeline: z.object({ upTo: z.number().min(0), rate: z.number().min(0) }).nullable().optional(),
});

export const billTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  calcMethod: z.enum(["FIXED", "METERED", "SLAB", "PER_PERSON", "MANUAL"]),
  rate: money,
  unitLabel: z.string().max(20).nullable().optional(),
  slabs: slabsSchema.nullable().optional(),
  fixedCharge: money,
  demandChargePerKw: money,
  vatPercent: z.number().min(0).max(100).nullable().optional(),
  appliesToAll: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateBillTypeSchema = billTypeSchema.partial();

export const flatChargesSchema = z.object({
  flats: z.array(z.object({
    flatId: z.number().int().positive(),
    isActive: z.boolean(),
    amount: money,
  })),
});

export const entriesQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

const reading = z.number().min(0).nullable().optional();

export const saveEntriesSchema = entriesQuerySchema.extend({
  entries: z.array(z.object({
    flatId: z.number().int().positive(),
    billTypeId: z.number().int().positive(),
    previousReading: reading,
    currentReading: reading,
    units: reading,
    amount: reading,
    note: z.string().max(500).nullable().optional(),
  })),
});

export type BillTypeInput = z.infer<typeof billTypeSchema>;
export type FlatChargesInput = z.infer<typeof flatChargesSchema>;
export type SaveEntriesInput = z.infer<typeof saveEntriesSchema>;
