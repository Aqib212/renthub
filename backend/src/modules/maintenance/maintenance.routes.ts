import { Router, Response } from "express";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { upload } from "../../shared/utils/upload";
import { MaintenanceService, createSchema, listSchema, updateSchema } from "./maintenance.service";

const service = new MaintenanceService();
const router = Router();
router.use(authenticate, requireOrg, writes("maintenance:write"));

router.get("/", validate(listSchema, "query"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.org!.id, req.query as any));
}));
// who a request can be assigned to (any member may see this short list)
router.get("/assignees", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.assignees(req.org!.id));
}));
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.get(req.org!.id, Number(req.params.id)));
}));
router.post("/", validate(createSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.create(req.org!.id, req.org!.membershipId, req.body), 201);
}));
router.patch("/:id", validate(updateSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.update(req.org!.id, Number(req.params.id), req.body));
}));
router.post("/:id/photos", upload.array("photos", 4), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.addPhotos(req.org!.id, req.org!.membershipId, Number(req.params.id), req.files as Express.Multer.File[]), 201);
}));
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.remove(req.org!.id, Number(req.params.id)));
}));

export default router;
