import { Router } from "express";
import * as c from "./agreement.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { createAgreementSchema, depositSchema, endSchema, noticeSchema, revisionSchema, updateAgreementSchema } from "./agreement.validation";

const router = Router();

router.use(authenticate, requireOrg, writes("property:write"));

router.get("/", c.list);
router.post("/", validate(createAgreementSchema), c.create);
router.get("/notice-requests", c.noticeRequests);
router.get("/:id", c.get);
router.patch("/:id", validate(updateAgreementSchema), c.update);
router.delete("/:id", c.remove);
router.post("/:id/activate", c.activate);
router.post("/:id/revisions", validate(revisionSchema), c.addRevision);
router.post("/:id/deposits", validate(depositSchema), c.addDeposit);
router.post("/:id/notice", validate(noticeSchema), c.giveNotice);
router.post("/:id/settlement", c.settlement);
router.post("/:id/end", validate(endSchema), c.end);
router.post("/:id/notice-requests/:rid/accept", c.acceptNotice);
router.post("/:id/notice-requests/:rid/decline", c.declineNotice);

export default router;
