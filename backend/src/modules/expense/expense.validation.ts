import { z } from "zod";

export const createExpenseSchema = z.object({
  category: z.enum(["LIFT", "SECURITY", "CLEANING", "COMMON_ELECTRICITY", "REPAIRS", "MAINTENANCE", "MISC", "HOLDING_TAX", "STAFF_SALARY"]),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  date: z.string().optional(),
  buildingId: z.coerce.number().int().positive().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.enum(["LIFT", "SECURITY", "CLEANING", "COMMON_ELECTRICITY", "REPAIRS", "MAINTENANCE", "MISC", "HOLDING_TAX", "STAFF_SALARY"]).optional(),
  buildingId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
