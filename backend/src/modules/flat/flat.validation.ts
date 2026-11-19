import { z } from "zod";

const flatStatusEnum = z.enum(["VACANT", "OCCUPIED", "UNDER_MAINTENANCE"]);

export const createFlatSchema = z.object({
  name: z.string().min(1, "Flat name is required").max(100),
  flatNumber: z.string().max(50).optional(),
  bedrooms: z.number().int().min(0).default(0),
  bathrooms: z.number().int().min(0).default(0),
  kitchens: z.number().int().min(0).default(1),
  balconies: z.number().int().min(0).default(0),
  area: z.number().positive().optional(),
  rent: z.number().positive("Rent must be greater than 0"),
  advance: z.number().min(0, "Advance must be 0 or greater"),
  securityDeposit: z.number().min(0).optional(),
  sanctionedLoad: z.number().min(0).nullable().optional(),
  status: flatStatusEnum.default("VACANT"),
});

export const updateFlatSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  flatNumber: z.string().max(50).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  kitchens: z.number().int().min(0).optional(),
  balconies: z.number().int().min(0).optional(),
  area: z.number().positive().optional(),
  rent: z.number().positive().optional(),
  advance: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
  sanctionedLoad: z.number().min(0).nullable().optional(),
  status: flatStatusEnum.optional(),
});

export type CreateFlatInput = z.infer<typeof createFlatSchema>;
export type UpdateFlatInput = z.infer<typeof updateFlatSchema>;
