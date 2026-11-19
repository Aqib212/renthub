import { Response } from "express";
import { BuildingService } from "./building.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const buildingService = new BuildingService();

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const building = await buildingService.create(req.user!.userId, req.body);
  sendSuccess(res, { statusCode: 201, message: "Building created", data: building });
});

export const findAll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await buildingService.findAll(req.user!.userId, req.query as any);
  sendSuccess(res, { statusCode: 200, message: "Buildings retrieved", data: result.data, meta: result.meta as any });
});

export const findById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const building = await buildingService.findById(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Building retrieved", data: building });
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const building = await buildingService.update(req.user!.userId, req.params.id, req.body);
  sendSuccess(res, { statusCode: 200, message: "Building updated", data: building });
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await buildingService.delete(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Building deleted" });
});
