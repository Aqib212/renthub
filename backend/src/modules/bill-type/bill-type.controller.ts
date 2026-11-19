import { Response } from "express";
import { BillTypeService } from "./bill-type.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const service = new BillTypeService();

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 200, message: "Bill types retrieved", data: await service.list(req.user!.userId) });
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 201, message: "Bill type created", data: await service.create(req.user!.userId, req.body) });
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.update(req.user!.userId, req.params.id, req.body);
  sendSuccess(res, { statusCode: 200, message: "Bill type updated", data });
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await service.remove(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Bill type deleted" });
});

export const getFlats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.getFlats(req.user!.userId, req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Flats retrieved", data });
});

export const setFlats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.setFlats(req.user!.userId, req.params.id, req.body);
  sendSuccess(res, { statusCode: 200, message: "Flats updated", data });
});

export const getEntries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query as unknown as { month: number; year: number };
  const data = await service.getEntries(req.user!.userId, month, year);
  sendSuccess(res, { statusCode: 200, message: "Bill entries retrieved", data });
});

export const saveEntries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.saveEntries(req.user!.userId, req.body);
  sendSuccess(res, { statusCode: 200, message: "Bill entries saved", data });
});
