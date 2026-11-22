import client from "./client";
import type { Membership, OrgRole } from "@/types";

export type StaffRole = Exclude<OrgRole, "OWNER">;

export interface OrgSettings {
  dueDay: number;
  noticeMonths: number;
  agreementClauses?: string[];
  portal?: { enabled: boolean };
  payInfo?: string;
  lateFee?: LateFee;
}

export interface LateFee { enabled: boolean; afterDays: number; type: "FLAT" | "PERCENT"; amount: number }
export interface Gateway { configured: boolean; storeId: string | null; sandbox: boolean }

export interface Organization {
  id: number;
  name: string;
  plan: string;
  settings: OrgSettings;
  myRole: OrgRole;
  /** the workspace has an SSLCommerz store set up */
  onlinePay?: boolean;
}

export interface Member {
  id: number;
  role: OrgRole;
  isActive: boolean;
  /** null = all buildings */
  buildingIds: number[] | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; email: string; phone: string | null; lastLoginAt: string | null };
}

export interface PermissionRow {
  role: OrgRole;
  actions: Record<string, boolean>;
}

export const orgApi = {
  mine: async (): Promise<Membership[]> => (await client.get("/orgs/mine")).data.data,
  current: async (): Promise<Organization> => (await client.get("/orgs/current")).data.data,
  update: async (body: { name?: string; settings?: Partial<OrgSettings> }): Promise<Organization> =>
    (await client.patch("/orgs/current", body)).data.data,
  members: async (): Promise<{ members: Member[]; permissions: PermissionRow[] }> =>
    (await client.get("/orgs/current/members")).data.data,
  invite: async (body: { email: string; firstName: string; lastName: string; phone?: string; role: StaffRole; buildingIds?: number[] | null }): Promise<Member> =>
    (await client.post("/orgs/current/members", body)).data.data,
  updateMember: async (id: number, body: { role?: StaffRole; isActive?: boolean; buildingIds?: number[] | null }): Promise<Member> =>
    (await client.patch(`/orgs/current/members/${id}`, body)).data.data,
  removeMember: async (id: number): Promise<void> => {
    await client.delete(`/orgs/current/members/${id}`);
  },
  gateway: async (): Promise<Gateway> => (await client.get("/orgs/current/gateway")).data.data,
  saveGateway: async (body: { storeId: string; storePass?: string; sandbox: boolean }): Promise<Gateway> =>
    (await client.put("/orgs/current/gateway", body)).data.data,
  removeGateway: async (): Promise<Gateway> => (await client.delete("/orgs/current/gateway")).data.data,
};
