import { z } from "zod";

export const createFloorSchema = z.object({
  name: z.string().min(1, "Floor name is required").max(100),
  description: z.string().optional(),
});

export const updateFloorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
