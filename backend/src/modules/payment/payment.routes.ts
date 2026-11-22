import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import * as paymentController from "./payment.controller";
import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { NotificationService } from "../notification/notification.service";

const router = Router();

router.use(authenticate, requireOrg, writes("payment:write"));

router.get("/", paymentController.findAll);
router.get("/:id", paymentController.findById);
router.get("/:id/receipt", paymentController.receipt);
router.post("/:id/share", paymentController.share);
router.get("/:id/share-text", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await new NotificationService().paymentShareText(req.org!.id, req.params.id));
}));
router.post("/", paymentController.create);
router.patch("/:id", paymentController.update);
router.delete("/:id", paymentController.remove);

/** No login: tenants open their receipt from the SMS link. */
export const publicReceiptRouter = Router();
publicReceiptRouter.get("/:token", paymentController.findByShareToken);

export default router;
