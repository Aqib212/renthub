import client from "./client";

export type PlanName = "FREE" | "STARTER" | "PRO" | "CUSTOM";
export const PLAN_LIMITS: Record<Exclude<PlanName, "CUSTOM">, number> = { FREE: 5, STARTER: 30, PRO: 150 };

export interface AdminOrg {
  id: number;
  name: string;
  plan: PlanName;
  unitLimit: number | null;
  paidUntil: string | null;
  suspendedAt: string | null;
  smsCredits: number;
  createdAt: string;
  owner: { firstName: string; lastName: string; email: string; phone: string | null; lastLoginAt: string | null } | null;
  units: number;
  vehicles: number;
  used: number;
  limit: number;
  expired: boolean;
  smsUsedThisMonth: number;
  openInvoices: number;
}
export interface CreditEntry { id: number; delta: number; reason: string; createdAt: string }

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const adminApi = {
  orgs: (search?: string) => d<AdminOrg[]>(client.get("/admin/orgs", { params: { search: search || undefined } })),
  update: (id: number, body: { plan?: PlanName; unitLimit?: number | null; paidUntil?: string | null; suspended?: boolean }) => d<AdminOrg>(client.patch(`/admin/orgs/${id}`, body)),
  credits: (id: number) => d<CreditEntry[]>(client.get(`/admin/orgs/${id}/sms-credits`)),
  addCredits: (id: number, body: { amount: number; reason: string }) => d<{ smsCredits: number; entries: CreditEntry[] }>(client.post(`/admin/orgs/${id}/sms-credits`, body)),
  support: (id: number) => d<{ accessToken: string; orgId: string; orgName: string; expiresIn: string }>(client.post(`/admin/orgs/${id}/support`)),
  smsBalance: () => d<{ driver: string; balance: number | null; error?: string }>(client.get("/admin/sms-balance")),
};
