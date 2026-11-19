import api from "./client";

export const dashboardApi = {
  getOverview: () => api.get("/dashboard/overview"),
};
