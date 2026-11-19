import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as invoiceController from "./invoice.controller";

const router = Router();

router.use(authenticate);
router.post("/generate-all", authorize("SUPER_ADMIN"), invoiceController.generateAllInvoices);
router.use(authorize("HOUSE_OWNER", "SUPER_ADMIN", "MANAGER", "ACCOUNTANT"));

router.get("/", invoiceController.findAll);
router.get("/:id", invoiceController.findById);
router.post("/generate", invoiceController.generateInvoices);
router.post("/generate-for-flat", invoiceController.generateForFlat);
router.patch("/:id", invoiceController.update);
router.post("/:id/share", invoiceController.share);
router.delete("/:id", invoiceController.remove);
router.patch("/:id/status", invoiceController.updateStatus);

/** No login: tenants open their invoice from a shared link. */
export const publicInvoiceRouter = Router();
publicInvoiceRouter.get("/:token", invoiceController.findByShareToken);

export default router;
