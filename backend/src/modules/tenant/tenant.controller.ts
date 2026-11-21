import { Response } from "express";
import { TenantService } from "./tenant.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const tenantService = new TenantService();

function extractFilePaths(files?: { [fieldname: string]: Express.Multer.File[] }) {
  if (!files) return undefined;
  return { photo: files.photo?.[0], agreementDoc: files.agreementDoc?.[0] };
}

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenant = await tenantService.create(String(req.org!.id), req.params.flatId, req.body, extractFilePaths(req.files as any));
  sendSuccess(res, { statusCode: 201, message: "Tenant created", data: tenant });
});

export const findAll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenants = await tenantService.findAll(String(req.org!.id), req.params.flatId);
  sendSuccess(res, { statusCode: 200, message: "Tenants retrieved", data: tenants });
});

export const findById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenant = await tenantService.findById(String(req.org!.id), req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Tenant retrieved", data: tenant });
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenant = await tenantService.update(String(req.org!.id), req.params.id, req.body, extractFilePaths(req.files as any));
  sendSuccess(res, { statusCode: 200, message: "Tenant updated", data: tenant });
});

export const findAllByOwner = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenants = await tenantService.findAllByOwner(String(req.org!.id));
  sendSuccess(res, { statusCode: 200, message: "Tenants retrieved", data: tenants });
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await tenantService.delete(String(req.org!.id), req.params.id);
  sendSuccess(res, { statusCode: 200, message: "Tenant deleted" });
});
