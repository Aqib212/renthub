import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as paymentController from "./payment.controller";

const router = Router();

router.use(authenticate);
router.use(authorize("HOUSE_OWNER", "SUPER_ADMIN", "MANAGER", "ACCOUNTANT"));

router.get("/", paymentController.findAll);
router.get("/:id", paymentController.findById);
router.post("/", paymentController.create);
router.patch("/:id", paymentController.update);
router.delete("/:id", paymentController.remove);

export default router;
