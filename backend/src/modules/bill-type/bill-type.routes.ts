import { Router } from "express";
import * as controller from "./bill-type.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { billTypeSchema, updateBillTypeSchema, flatChargesSchema, entriesQuerySchema, saveEntriesSchema } from "./bill-type.validation";

const router = Router();
router.use(authenticate, requireOrg, writes("billing:write"));

router.get("/", controller.list);
router.post("/", validate(billTypeSchema), controller.create);
router.patch("/:id", validate(updateBillTypeSchema), controller.update);
router.delete("/:id", controller.remove);
router.get("/:id/flats", controller.getFlats);
router.put("/:id/flats", validate(flatChargesSchema), controller.setFlats);

export const billEntryRouter = Router();
billEntryRouter.use(authenticate, requireOrg, writes("billing:write"));
billEntryRouter.get("/", validate(entriesQuerySchema, "query"), controller.getEntries);
billEntryRouter.put("/bulk", validate(saveEntriesSchema), controller.saveEntries);

export default router;
