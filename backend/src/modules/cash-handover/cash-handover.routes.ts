import { Router, Response } from "express";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { requireOrg, permit, writes } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { CashHandoverService, handoverSchema } from "./cash-handover.service";

const service = new CashHandoverService();
const router = Router();

// any member may see who holds cash; recording a handover is for the receiver (owner / manager)
router.use(authenticate, requireOrg, writes("cash:handover"));

router.get("/pending", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.pending(req.org!.id));
}));
router.get("/", permit("report:read"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.org!.id));
}));
router.post("/", validate(handoverSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.create(req.org!.id, req.org!.membershipId, req.body), 201);
}));

export default router;
