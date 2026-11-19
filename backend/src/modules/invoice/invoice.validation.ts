import { z } from "zod";

export const generateInvoiceSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "OVERDUE"]).optional(),
  search: z.string().optional(),
});

export const generateForFlatSchema = z.object({
  flatId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  dryRun: z.boolean().default(false),
});

export const updateInvoiceSchema = z.object({
  items: z
    .array(z.object({
      billTypeId: z.number().int().positive().nullable().optional(),
      label: z.string().trim().min(1).max(100),
      detail: z.string().max(255).nullable().optional(),
      amount: z.number(),
    }))
    .min(1)
    .optional(),
  discount: z.number().min(0).optional(),
  fine: z.number().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "OVERDUE"]),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
