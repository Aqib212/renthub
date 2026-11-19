import { Router } from "express";
import * as buildingController from "./building.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { createBuildingSchema, updateBuildingSchema, buildingQuerySchema } from "./building.validation";

const router = Router();

router.use(authenticate, requireOrg, writes("property:write"));

router.get("/", validate(buildingQuerySchema, "query"), buildingController.findAll);
router.post("/", validate(createBuildingSchema), buildingController.create);
router.get("/:id", buildingController.findById);
router.patch("/:id", validate(updateBuildingSchema), buildingController.update);
router.delete("/:id", buildingController.remove);

export default router;
