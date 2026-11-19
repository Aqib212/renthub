import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.get("/overview", authenticate, dashboardController.getOverview);

export default router;
