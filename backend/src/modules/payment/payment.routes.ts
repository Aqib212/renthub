import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import * as paymentController from "./payment.controller";

const router = Router();

router.use(authenticate, requireOrg, writes("payment:write"));

router.get("/", paymentController.findAll);
router.get("/:id", paymentController.findById);
router.get("/:id/receipt", paymentController.receipt);
router.post("/:id/share", paymentController.share);
router.post("/", paymentController.create);
router.patch("/:id", paymentController.update);
router.delete("/:id", paymentController.remove);

/** No login: tenants open their receipt from the SMS link. */
export const publicReceiptRouter = Router();
publicReceiptRouter.get("/:token", paymentController.findByShareToken);

export default router;
