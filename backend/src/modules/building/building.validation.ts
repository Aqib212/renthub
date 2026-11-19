import { z } from "zod";

export const createBuildingSchema = z.object({
  name: z.string().min(1, "Building name is required").max(200),
  holdingNumber: z.string().max(100).optional(),
  address: z.string().optional(),
  ward: z.string().max(50).optional(),
  area: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  description: z.string().optional(),
});

export const updateBuildingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  holdingNumber: z.string().max(100).optional(),
  address: z.string().optional(),
  ward: z.string().max(50).optional(),
  area: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  description: z.string().optional(),
});

export const buildingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
