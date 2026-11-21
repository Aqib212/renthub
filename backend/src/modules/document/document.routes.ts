import { Router, Response } from "express";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { upload } from "../../shared/utils/upload";
import { DocumentService, listSchema } from "./document.service";

const service = new DocumentService();
const router = Router();

// files are served only here, after authentication and the org check (never express.static)
router.use(authenticate, requireOrg, writes("document:write"));

router.get("/", validate(listSchema, "query"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.list(req.org!.id, req.query as any));
}));
router.get("/:id/file", asyncHandler(async (req: AuthRequest, res: Response) => {
  const { doc, abs } = await service.file(req.org!.id, Number(req.params.id));
  if (doc.mime) res.type(doc.mime);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(abs);
}));
router.post("/", upload.single("file"), asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.create(req.org!.id, req.org!.membershipId, req.file, req.body), 201);
}));
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  sendResult(res, await service.remove(req.org!.id, Number(req.params.id)));
}));

export default router;
