import { Router } from "express";
import * as orgController from "./org.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireOrg, permit } from "../../middleware/org.middleware";
import { inviteMemberSchema, updateMemberSchema, updateOrgSchema } from "./org.validation";

const router = Router();

// every workspace the user belongs to; needs no X-Org-Id (it feeds the switcher)
router.get("/mine", authenticate, orgController.mine);

router.use(authenticate, requireOrg);
router.get("/current", orgController.getCurrent);
router.patch("/current", permit("settings:write"), validate(updateOrgSchema), orgController.update);
router.get("/current/members", permit("staff:manage"), orgController.listMembers);
router.post("/current/members", permit("staff:manage"), validate(inviteMemberSchema), orgController.invite);
router.patch("/current/members/:memberId", permit("staff:manage"), validate(updateMemberSchema), orgController.updateMember);
router.delete("/current/members/:memberId", permit("staff:manage"), orgController.removeMember);

export default router;
