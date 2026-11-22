import { Router, Response } from "express";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { permit, requireOrg, writes } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { VehicleService, dayEntrySchema, jamaQuerySchema, openSchema, vehicleSchema, vehicleUpdateSchema } from "./vehicle.service";

const service = new VehicleService();

const router = Router();
router.use(authenticate, requireOrg, writes("property:write"));
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.org!.id));
}));
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.get(req.org!.id, Number(req.params.id)));
}));
router.post("/", validate(vehicleSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.create(req.org!.id, req.body), 201);
}));
router.patch("/:id", validate(vehicleUpdateSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.update(req.org!.id, Number(req.params.id), req.body));
}));
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.remove(req.org!.id, Number(req.params.id)));
}));
export default router;

/** Today's jama sheet. A caretaker collects (payment:write); only OWNER/MANAGER waive or change a day (billing:write). */
export const jamaRouter = Router();
jamaRouter.use(authenticate, requireOrg);
jamaRouter.get("/", validate(jamaQuerySchema, "query"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.jama(req.org!.id, req.query.date as string | undefined));
}));
jamaRouter.post("/open", permit("payment:write"), validate(openSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.openInvoice(req.org!.id, req.body));
}));
jamaRouter.put("/days", permit("billing:write"), validate(dayEntrySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.setDay(req.org!.id, req.org!.membershipId, req.body));
}));
jamaRouter.delete("/days/:id", permit("billing:write"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.clearDay(req.org!.id, Number(req.params.id)));
}));
