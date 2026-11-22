import { Router, Response } from "express";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { permit, requireOrg } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { BookingService, cancelSchema, createBookingSchema, listSchema, sheetSchema, startSchema, updateBookingSchema } from "./booking.service";

const service = new BookingService();

/** Rent-a-car. Any member reads; OWNER/MANAGER book, change and cancel (billing:write); whoever collects (payment:write) runs the trip sheet. */
const router = Router();
router.use(authenticate, requireOrg);
router.get("/", validate(listSchema, "query"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.org!.id, req.query as any));
}));
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.get(req.org!.id, Number(req.params.id)));
}));
router.post("/", permit("billing:write"), validate(createBookingSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.create(req.org!.id, req.org!.membershipId, req.body), 201);
}));
router.patch("/:id", permit("billing:write"), validate(updateBookingSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.update(req.org!.id, Number(req.params.id), req.body));
}));
router.post("/:id/cancel", permit("billing:write"), validate(cancelSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.cancel(req.org!.id, Number(req.params.id), req.body));
}));
router.post("/:id/start", permit("payment:write"), validate(startSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.start(req.org!.id, Number(req.params.id), req.body));
}));
router.put("/:id/sheet", permit("payment:write"), validate(sheetSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.sheet(req.org!.id, Number(req.params.id), req.body));
}));
router.post("/:id/close", permit("payment:write"), validate(sheetSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.sheet(req.org!.id, Number(req.params.id), req.body, true));
}));
export default router;
