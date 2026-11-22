import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import * as invoiceController from "./invoice.controller";
import { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { NotificationService } from "../notification/notification.service";

const router = Router();

// platform admin (no organisation): runs before requireOrg
router.post("/generate-all", authenticate, authorize("SUPER_ADMIN"), invoiceController.generateAllInvoices);
router.use(authenticate, requireOrg, writes("billing:write"));

router.get("/", invoiceController.findAll);
router.get("/:id", invoiceController.findById);
router.post("/generate", invoiceController.generateInvoices);
router.post("/generate-for-flat", invoiceController.generateForFlat);
router.patch("/:id", invoiceController.update);
router.post("/:id/share", invoiceController.share);
router.get("/:id/share-text", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await new NotificationService().invoiceShareText(req.org!.id, req.params.id));
}));
router.post("/:id/remind", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await new NotificationService().remindInvoice(req.org!.id, req.params.id));
}));
router.delete("/:id", invoiceController.remove);
router.patch("/:id/status", invoiceController.updateStatus);

/** No login: tenants open their invoice from a shared link. */
export const publicInvoiceRouter = Router();
publicInvoiceRouter.get("/:token", invoiceController.findByShareToken);

export default router;
