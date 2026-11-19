import { Router, Response } from "express";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { requireOrg, permit } from "../../middleware/org.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { NotificationService } from "./notification.service";

const service = new NotificationService();
const router = Router();

router.use(authenticate, requireOrg);

router.get("/", permit("report:read"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.org!.id, req.query as any));
}));
router.get("/preview", asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendResult(res, service.preview());
}));
router.post("/:id/retry", permit("billing:write"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.retry(req.org!.id, req.params.id));
}));

export default router;
