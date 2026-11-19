import { Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { AgreementService } from "./agreement.service";
import { endSchema } from "./agreement.validation";

const service = new AgreementService();
const ok = (res: Response, message: string, data: unknown, statusCode = 200) => sendSuccess(res, { statusCode, message, data });

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Agreements", await service.list(req.org!.id, req.query as any));
});

export const get = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Agreement", await service.get(req.org!.id, req.params.id));
});

/** Write endpoints return `{ agreement, warnings }`: Bangladesh rent rules warn, never block. */
export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Agreement created", await service.create(req.org!.id, req.body), 201);
});

export const activate = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Agreement activated", { agreement: await service.activate(req.org!.id, req.params.id), warnings: [] });
});

export const addRevision = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Rent revision added", await service.addRevision(req.org!.id, req.params.id, req.body), 201);
});

export const addDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Deposit entry added", await service.addDeposit(req.org!.id, req.params.id, req.body), 201);
});

export const giveNotice = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Notice recorded", await service.giveNotice(req.org!.id, req.params.id, req.body));
});

export const settlement = asyncHandler(async (req: AuthRequest, res: Response) => {
  // POST so the deductions list can be sent; nothing is saved
  ok(res, "Settlement preview", await service.settlementPreview(req.org!.id, req.params.id, endSchema.parse(req.body)));
});

export const end = asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Agreement ended", await service.end(req.org!.id, req.params.id, req.body));
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await service.remove(req.org!.id, req.params.id);
  ok(res, "Draft deleted", null);
});
