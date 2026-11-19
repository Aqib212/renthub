import api from "./client";
import type { TenantFormData } from "@/types/tenant";

const base = (buildingId: number, floorId: number, flatId: number) =>
  `/buildings/${buildingId}/floors/${floorId}/flats/${flatId}/tenants`;

export const tenantApi = {
  getAll: (buildingId: number, floorId: number, flatId: number) =>
    api.get(base(buildingId, floorId, flatId)),
  getAllForOwner: () => api.get("/tenants"),
  getById: (buildingId: number, floorId: number, flatId: number, id: number) =>
    api.get(`${base(buildingId, floorId, flatId)}/${id}`),
  create: (buildingId: number, floorId: number, flatId: number, data: FormData) =>
    api.post(base(buildingId, floorId, flatId), data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (buildingId: number, floorId: number, flatId: number, id: number, data: FormData) =>
    api.patch(`${base(buildingId, floorId, flatId)}/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (buildingId: number, floorId: number, flatId: number, id: number) =>
    api.delete(`${base(buildingId, floorId, flatId)}/${id}`),
};
