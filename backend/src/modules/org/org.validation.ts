import { z } from "zod";

const staffRole = z.enum(["MANAGER", "CARETAKER", "ACCOUNTANT"]);

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: staffRole,
  /** null / absent = all buildings */
  buildingIds: z.array(z.number().int().positive()).max(200).nullable().optional(),
});

export const updateMemberSchema = z.object({
  role: staffRole.optional(),
  isActive: z.boolean().optional(),
  buildingIds: z.array(z.number().int().positive()).max(200).nullable().optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  settings: z
    .object({
      dueDay: z.number().int().min(1).max(28).optional(),
      noticeMonths: z.number().int().min(1).max(6).optional(),
      sms: z.object({ enabled: z.boolean().optional(), reminders: z.boolean().optional() }).optional(),
      agreementClauses: z.array(z.string().trim().min(1).max(1000)).max(30).optional(),
      portal: z.object({ enabled: z.boolean().optional() }).optional(),
      payInfo: z.string().max(1000).optional(),
      lateFee: z
        .object({
          enabled: z.boolean().optional(),
          afterDays: z.number().int().min(0).max(60).optional(),
          type: z.enum(["FLAT", "PERCENT"]).optional(),
          amount: z.number().min(0).max(100000).optional(),
        })
        .refine((v) => v.type !== "PERCENT" || (v.amount ?? 0) <= 50, { message: "A percentage late fee can be at most 50%", path: ["amount"] })
        .optional(),
    })
    .optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
