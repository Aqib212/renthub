import { z } from "zod";

export const createPaymentSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "CHEQUE", "TDS"]),
  transactionId: z.string().max(100).optional(),
  collector: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
  date: z.string().optional(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  invoiceId: z.coerce.number().int().positive().optional(),
  method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "CHEQUE", "TDS"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
