import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg } from "../../middleware/org.middleware";

const router = Router();

router.get("/overview", authenticate, requireOrg, dashboardController.getOverview);

export default router;
