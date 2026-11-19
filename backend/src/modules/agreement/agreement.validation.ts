import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const money = z.coerce.number().min(0);

export const partyFields = {
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  nid: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  members: z.coerce.number().int().min(1).max(50).optional(),
  kind: z.enum(["PERSON", "COMPANY"]).optional(),
};

export const createAgreementSchema = z
  .object({
    flatId: z.coerce.number().int().positive(),
    tenantId: z.coerce.number().int().positive().optional(),
    tenant: z.object(partyFields).optional(),
    rate: z.coerce.number().positive().optional(), // defaults to the unit's asking rent
    startDate: date,
    endDate: date.optional(),
    dueDay: z.coerce.number().int().min(1).max(28).optional(),
    noticeDays: z.coerce.number().int().min(0).max(365).optional(),
    tdsPercent: z.coerce.number().min(0).max(30).optional(),
    deposit: money.optional(), // received at signing
    activate: z.boolean().default(true),
    firstInvoice: z.boolean().default(false),
  })
  .refine((v) => v.tenantId || v.tenant, { message: "Choose a tenant or enter one", path: ["tenantId"] });

export const revisionSchema = z.object({ effectiveFrom: date, rate: z.coerce.number().positive(), reason: z.string().max(255).optional() });

export const depositSchema = z.object({
  type: z.enum(["RECEIVED", "ADJUSTED", "DEDUCTED_DAMAGE", "REFUNDED"]),
  amount: z.coerce.number().positive(),
  date,
  note: z.string().max(255).optional(),
});

export const noticeSchema = z.object({ noticeDate: date, endDate: date.optional() });

export const endSchema = z.object({
  endDate: date,
  deductions: z.array(z.object({ amount: z.coerce.number().positive(), note: z.string().min(1).max(255) })).default([]),
  finalInvoice: z.boolean().default(true),
  refund: z.boolean().default(true), // record the refund now
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type RevisionInput = z.infer<typeof revisionSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type NoticeInput = z.infer<typeof noticeSchema>;
export type EndInput = z.infer<typeof endSchema>;
