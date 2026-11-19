import client from "./client";
import type { Membership, OrgRole } from "@/types";

export type StaffRole = Exclude<OrgRole, "OWNER">;

export interface OrgSettings {
  dueDay: number;
  noticeMonths: number;
}

export interface Organization {
  id: number;
  name: string;
  plan: string;
  settings: OrgSettings;
  myRole: OrgRole;
}

export interface Member {
  id: number;
  role: OrgRole;
  isActive: boolean;
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
  invite: async (body: { email: string; firstName: string; lastName: string; phone?: string; role: StaffRole }): Promise<Member> =>
    (await client.post("/orgs/current/members", body)).data.data,
  updateMember: async (id: number, body: { role?: StaffRole; isActive?: boolean }): Promise<Member> =>
    (await client.patch(`/orgs/current/members/${id}`, body)).data.data,
  removeMember: async (id: number): Promise<void> => {
    await client.delete(`/orgs/current/members/${id}`);
  },
};
