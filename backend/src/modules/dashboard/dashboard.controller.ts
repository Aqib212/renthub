import { Response } from "express";
import { DashboardService } from "./dashboard.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const dashboardService = new DashboardService();

export const getOverview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await dashboardService.getOverview(String(req.org!.id));
  sendSuccess(res, {
    statusCode: 200,
    message: "Dashboard data retrieved",
    data,
  });
});
