import { Router } from "express";
import * as floorController from "./floor.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { createFloorSchema, updateFloorSchema } from "./floor.validation";

const router = Router({ mergeParams: true });

router.use(authenticate, requireOrg, writes("property:write"));

router.get("/", floorController.findAll);
router.post("/", validate(createFloorSchema), floorController.create);
router.get("/:id", floorController.findById);
router.patch("/:id", validate(updateFloorSchema), floorController.update);
router.delete("/:id", floorController.remove);

export const topLevelFloorRouter = Router();

topLevelFloorRouter.use(authenticate, requireOrg, writes("property:write"));

topLevelFloorRouter.get("/", floorController.findAllByOwner);

export default router;
