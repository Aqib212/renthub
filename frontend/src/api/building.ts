import api from "./client";
import type { BuildingFormData } from "@/types/building";

export const buildingApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get("/buildings", { params }),
  getById: (id: number) => api.get(`/buildings/${id}`),
  create: (data: BuildingFormData) => api.post("/buildings", data),
  update: (id: number, data: Partial<BuildingFormData>) => api.patch(`/buildings/${id}`, data),
  delete: (id: number) => api.delete(`/buildings/${id}`),
};
