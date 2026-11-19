import { Router } from "express";
import * as floorController from "./floor.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { createFloorSchema, updateFloorSchema } from "./floor.validation";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/", floorController.findAll);
router.post("/", validate(createFloorSchema), floorController.create);
router.get("/:id", floorController.findById);
router.patch("/:id", validate(updateFloorSchema), floorController.update);
router.delete("/:id", floorController.remove);

export const topLevelFloorRouter = Router();

topLevelFloorRouter.use(authenticate);

topLevelFloorRouter.get("/", floorController.findAllByOwner);

export default router;
