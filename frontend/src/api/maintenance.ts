import client from "./client";

export type MaintenanceStatus = "NEW" | "ASSIGNED" | "WAITING" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type Priority = "LOW" | "NORMAL" | "URGENT";

export interface MaintenanceRequest {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  priority: Priority;
  status: MaintenanceStatus;
  cost: number | null;
  expenseId: number | null;
  blocksUnit: boolean;
  resolvedAt: string | null;
  createdAt: string;
  unit: { id: number; name: string; status: string; floorName: string; building: { id: number; name: string } } | null;
  tenant: { id: number; name: string; phone: string | null } | null;
  assignedTo: { id: number; name: string } | null;
  createdBy: { id: number; name: string } | null;
  photos: { id: number; name: string; mime: string | null }[];
}

export interface MaintenanceInput {
  flatId?: number;
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: Priority;
  assignedToId?: number | null;
  blocksUnit?: boolean;
  status?: MaintenanceStatus;
  cost?: number | null;
  createExpense?: boolean;
}

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const maintenanceApi = {
  list: (params: { status?: MaintenanceStatus | "OPEN"; buildingId?: number; flatId?: number; page?: number; limit?: number }) =>
    d<{ rows: MaintenanceRequest[]; counts: Partial<Record<MaintenanceStatus, number>> }>(client.get("/maintenance", { params })),
  create: (body: MaintenanceInput) => d<MaintenanceRequest>(client.post("/maintenance", body)),
  update: (id: number, body: MaintenanceInput) => d<MaintenanceRequest>(client.patch(`/maintenance/${id}`, body)),
  addPhotos: (id: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f));
    return d<MaintenanceRequest>(client.post(`/maintenance/${id}/photos`, fd, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  remove: (id: number) => client.delete(`/maintenance/${id}`),
  assignees: () => d<{ id: number; role: string; name: string }[]>(client.get("/maintenance/assignees")),
};

export const MAINTENANCE_STATUS: Record<MaintenanceStatus, { label: string; tone: "info" | "warning" | "ok" | "muted" | "error" }> = {
  NEW: { label: "New", tone: "info" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  WAITING: { label: "Waiting", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  DONE: { label: "Done", tone: "ok" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
