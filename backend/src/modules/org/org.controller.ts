import { Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { membershipsOf } from "../auth/auth.service";
import { toNumberId } from "../../shared/utils/helpers";
import { OrgService } from "./org.service";

const orgService = new OrgService();

export const mine = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 200, message: "Organisations", data: await membershipsOf(toNumberId(req.user!.userId)) });
});

export const getCurrent = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 200, message: "Organisation", data: { ...(await orgService.getCurrent(req.org!.id)), myRole: req.org!.role } });
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 200, message: "Organisation updated", data: await orgService.update(req.org!.id, req.body) });
});

export const listMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 200, message: "Members", data: await orgService.listMembers(req.org!.id) });
});

export const invite = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 201, message: "Member added", data: await orgService.invite(req.org!.id, req.body) });
});

export const updateMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { statusCode: 200, message: "Member updated", data: await orgService.updateMember(req.org!.id, req.params.memberId, req.body) });
});

export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  await orgService.removeMember(req.org!.id, req.params.memberId);
  sendSuccess(res, { statusCode: 200, message: "Member removed" });
});
