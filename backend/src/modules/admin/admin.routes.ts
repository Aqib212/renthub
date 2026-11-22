import { Router, Response } from "express";
import { authenticate, authorize, type AuthRequest } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { ForbiddenError } from "../../shared/utils/errors";
import { AdminService, creditSchema, listSchema, planSchema } from "./admin.service";

const service = new AdminService();

/** Platform console: SUPER_ADMIN only, outside any workspace (no requireOrg). */
const router = Router();
router.use(authenticate, authorize("SUPER_ADMIN"), (req: AuthRequest, _res, next) =>
  // a support-view token is for looking at one workspace, not for running the console
  req.user?.support ? next(new ForbiddenError("Exit the support view first")) : next());

router.get("/orgs", validate(listSchema, "query"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.query as any));
}));
router.patch("/orgs/:id", validate(planSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.update(Number(req.user!.userId), Number(req.params.id), req.body));
}));
router.get("/orgs/:id/sms-credits", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.creditHistory(Number(req.params.id)));
}));
router.post("/orgs/:id/sms-credits", validate(creditSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.credits(Number(req.user!.userId), Number(req.params.id), req.body));
}));
router.post("/orgs/:id/support", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.support(req.user!, Number(req.params.id)));
}));
router.get("/sms-balance", asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendResult(res, await service.smsBalance());
}));
export default router;
