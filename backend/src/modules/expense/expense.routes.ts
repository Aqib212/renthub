import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as expenseController from "./expense.controller";

const router = Router();

router.use(authenticate);
router.use(authorize("HOUSE_OWNER", "SUPER_ADMIN", "MANAGER", "ACCOUNTANT"));

router.get("/", expenseController.findAll);
router.get("/:id", expenseController.findById);
router.post("/", expenseController.create);
router.patch("/:id", expenseController.update);
router.delete("/:id", expenseController.remove);

export default router;
