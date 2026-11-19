import { Response } from "express";
import { FloorService } from "./floor.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const floorService = new FloorService();

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const floor = await floorService.create(req.user!.userId, req.params.buildingId, req.body);
  sendSuccess(res, { statusCode: 201, message: "Floor created", data: floor });
});

export const findAll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const floors = await floorService.findAll(req.user!.userId, req.params.buildingId);
  sendSuccess(res, { statusCode: 200, message: "Floors retrieved", data: floors });
});

export const findById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const floor = await floorService.findById(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Floor retrieved", data: floor });
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const floor = await floorService.update(req.user!.userId, req.params.id, req.body);
  sendSuccess(res, { statusCode: 200, message: "Floor updated", data: floor });
});

export const findAllByOwner = asyncHandler(async (req: AuthRequest, res: Response) => {
  const floors = await floorService.findAllByOwner(req.user!.userId);
  sendSuccess(res, { statusCode: 200, message: "Floors retrieved", data: floors });
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await floorService.delete(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Floor deleted" });
});
