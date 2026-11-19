import { Router } from "express";
import * as flatController from "./flat.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { createFlatSchema, updateFlatSchema } from "./flat.validation";

const router = Router({ mergeParams: true });

router.use(authenticate, requireOrg, writes("property:write"));

router.get("/", flatController.findAll);
router.post("/", validate(createFlatSchema), flatController.create);
router.get("/:id", flatController.findById);
router.patch("/:id", validate(updateFlatSchema), flatController.update);
router.delete("/:id", flatController.remove);

export const topLevelFlatRouter = Router();

topLevelFlatRouter.use(authenticate, requireOrg, writes("property:write"));

topLevelFlatRouter.get("/", flatController.findAllByOwner);

export default router;
