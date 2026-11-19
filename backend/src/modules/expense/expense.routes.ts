import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import * as expenseController from "./expense.controller";

const router = Router();

router.use(authenticate, requireOrg, writes("expense:write"));

router.get("/", expenseController.findAll);
router.get("/:id", expenseController.findById);
router.post("/", expenseController.create);
router.patch("/:id", expenseController.update);
router.delete("/:id", expenseController.remove);

export default router;
