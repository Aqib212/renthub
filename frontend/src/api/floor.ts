import api from "./client";
import type { FloorFormData } from "@/types/floor";

export const floorApi = {
  getAll: (buildingId: number) => api.get(`/buildings/${buildingId}/floors`),
  getAllForOwner: () => api.get("/floors"),
  getById: (buildingId: number, id: number) => api.get(`/buildings/${buildingId}/floors/${id}`),
  create: (buildingId: number, data: FloorFormData) => api.post(`/buildings/${buildingId}/floors`, data),
  update: (buildingId: number, id: number, data: Partial<FloorFormData>) =>
    api.patch(`/buildings/${buildingId}/floors/${id}`, data),
  delete: (buildingId: number, id: number) => api.delete(`/buildings/${buildingId}/floors/${id}`),
};
