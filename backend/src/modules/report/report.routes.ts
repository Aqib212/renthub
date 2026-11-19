import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, permit } from "../../middleware/org.middleware";
import * as reportController from "./report.controller";

const router = Router();

router.use(authenticate, requireOrg, permit("report:read"));

router.get("/", reportController.getReport);
router.get("/pdf", reportController.downloadPDF);
router.get("/excel", reportController.downloadExcel);

export default router;
