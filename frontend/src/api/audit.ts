import client from "./client";

export interface AuditRow {
  id: number;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string } | null;
  /** set when a tenant acted in the portal */
  tenant: { id: number; firstName: string; lastName: string } | null;
}

export const auditApi = {
  list: (params: { action?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    client.get("/audit-logs", { params }).then((r) => ({ data: r.data.data as AuditRow[], meta: r.data.meta as { total: number; page: number; totalPages: number } })),
};
