import { z } from "zod";

export const createTenantSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  nid: z.string().max(50).optional(),
  passport: z.string().max(50).optional(),
  drivingLicense: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  office: z.string().max(255).optional(),
  emergencyContact: z.string().max(20).optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  moveInDate: z.string().optional(),
  moveOutDate: z.string().optional(),
  members: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["ACTIVE", "FORMER"]).default("ACTIVE"),
});

export const updateTenantSchema = createTenantSchema.partial();

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
