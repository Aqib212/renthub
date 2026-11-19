import api from "./client";
import type { FlatFormData } from "@/types/flat";

export const flatApi = {
  getAll: (buildingId: number, floorId: number) =>
    api.get(`/buildings/${buildingId}/floors/${floorId}/flats`),
  getAllForOwner: () => api.get("/flats"),
  getById: (buildingId: number, floorId: number, id: number) =>
    api.get(`/buildings/${buildingId}/floors/${floorId}/flats/${id}`),
  create: (buildingId: number, floorId: number, data: FlatFormData) =>
    api.post(`/buildings/${buildingId}/floors/${floorId}/flats`, data),
  update: (buildingId: number, floorId: number, id: number, data: Partial<FlatFormData>) =>
    api.patch(`/buildings/${buildingId}/floors/${floorId}/flats/${id}`, data),
  delete: (buildingId: number, floorId: number, id: number) =>
    api.delete(`/buildings/${buildingId}/floors/${floorId}/flats/${id}`),
};
