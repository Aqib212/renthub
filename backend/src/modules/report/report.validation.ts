import { z } from "zod";

export const reportQuerySchema = z.object({
  type: z.enum(["income_expense", "collection", "rent_roll", "outstanding", "expense_detail"]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  buildingId: z.coerce.number().int().positive().optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
