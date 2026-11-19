import { Response } from "express";
import { FlatService } from "./flat.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const flatService = new FlatService();

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const flat = await flatService.create(req.user!.userId, req.params.floorId, req.body);
  sendSuccess(res, { statusCode: 201, message: "Flat created", data: flat });
});

export const findAll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const flats = await flatService.findAll(req.user!.userId, req.params.floorId);
  sendSuccess(res, { statusCode: 200, message: "Flats retrieved", data: flats });
});

export const findById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const flat = await flatService.findById(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Flat retrieved", data: flat });
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const flat = await flatService.update(req.user!.userId, req.params.id, req.body);
  sendSuccess(res, { statusCode: 200, message: "Flat updated", data: flat });
});

export const findAllByOwner = asyncHandler(async (req: AuthRequest, res: Response) => {
  const flats = await flatService.findAllByOwner(req.user!.userId);
  sendSuccess(res, { statusCode: 200, message: "Flats retrieved", data: flats });
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await flatService.delete(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Flat deleted" });
});
