import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as reportController from "./report.controller";

const router = Router();

router.use(authenticate);
router.use(authorize("HOUSE_OWNER", "SUPER_ADMIN", "MANAGER", "ACCOUNTANT"));

router.get("/", reportController.getReport);
router.get("/pdf", reportController.downloadPDF);
router.get("/excel", reportController.downloadExcel);

export default router;
