import { Router } from "express";
import * as tenantController from "./tenant.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { createTenantSchema, updateTenantSchema } from "./tenant.validation";
import { uploadFields } from "../../shared/utils/upload";

const router = Router({ mergeParams: true });

router.use(authenticate, requireOrg, writes("property:write"));

router.get("/", tenantController.findAll);
router.post("/", uploadFields, validate(createTenantSchema), tenantController.create);
router.get("/:id", tenantController.findById);
router.patch("/:id", uploadFields, validate(updateTenantSchema), tenantController.update);
router.delete("/:id", tenantController.remove);

export const topLevelTenantRouter = Router();

topLevelTenantRouter.use(authenticate, requireOrg, writes("property:write"));

topLevelTenantRouter.get("/", tenantController.findAllByOwner);
topLevelTenantRouter.get("/:id", tenantController.findById);
topLevelTenantRouter.patch("/:id", validate(updateTenantSchema), tenantController.update);

export default router;
