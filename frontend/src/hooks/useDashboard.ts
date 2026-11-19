import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard";
import type { DashboardData } from "@/types/dashboard";

export const useDashboard = () => {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await dashboardApi.getOverview();
      return response.data.data;
    },
  });
};
