import { Router, Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { validate } from "../../middleware/validate.middleware";
import { upload } from "../../shared/utils/upload";
import { prisma } from "../../shared/prisma";
import { NotFoundError } from "../../shared/utils/errors";
import { asTenant, portalAuthRouter, tenantAuth, type PortalRequest } from "./portal.auth";
import { PortalService, claimSchema, maintenanceSchema, noticeSchema } from "./portal.service";

const service = new PortalService();
const ids = (req: PortalRequest) => req.portal!.tenantIds;
const num = (v: unknown) => Number(v) || 0;

/** The tenant portal API: /api/v1/portal. Login under /auth; everything else needs a tenant token. */
const router = Router();
router.use("/auth", portalAuthRouter);
router.use(tenantAuth);

router.get("/home", asyncHandler(async (req: PortalRequest, res: Response) => {
  sendResult(res, { phone: req.portal!.phone, ...(await service.home(ids(req))) });
}));
router.get("/invoices", asyncHandler(async (req: PortalRequest, res: Response) => {
  sendResult(res, await service.invoices(ids(req), num(req.query.agreementId)));
}));
router.get("/payments", asyncHandler(async (req: PortalRequest, res: Response) => {
  sendResult(res, await service.payments(ids(req), num(req.query.agreementId)));
}));
router.get("/agreements/:id", asyncHandler(async (req: PortalRequest, res: Response) => {
  sendResult(res, await service.agreement(ids(req), num(req.params.id)));
}));

router.get("/maintenance", asyncHandler(async (req: PortalRequest, res: Response) => {
  sendResult(res, await service.listMaintenance(ids(req)));
}));
router.post("/maintenance", validate(maintenanceSchema), asyncHandler(async (req: PortalRequest, res: Response) => {
  const ctx = await service.noticeContext(ids(req), req.body.agreementId);
  sendResult(res, await asTenant(req, ctx.orgId, ctx.tenantId, () => service.createMaintenance(ids(req), req.body)), 201);
}));
router.post("/maintenance/:id/photos", upload.array("photos", 4), asyncHandler(async (req: PortalRequest, res: Response) => {
  sendResult(res, await service.addPhotos(ids(req), num(req.params.id), (req.files as Express.Multer.File[]) ?? []), 201);
}));
router.get("/files/:id", asyncHandler(async (req: PortalRequest, res: Response) => {
  const { doc, abs } = await service.file(ids(req), num(req.params.id));
  if (doc.mime) res.type(doc.mime);
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(abs);
}));

router.post("/claims", validate(claimSchema), asyncHandler(async (req: PortalRequest, res: Response) => {
  const ctx = await service.claimContext(ids(req), req.body.invoiceId);
  sendResult(res, await asTenant(req, ctx.orgId, ctx.tenantId, () => service.createClaim(ids(req), req.body)), 201);
}));

router.post("/notice", validate(noticeSchema), asyncHandler(async (req: PortalRequest, res: Response) => {
  const ctx = await service.noticeContext(ids(req), req.body.agreementId);
  const { request, warnings } = await asTenant(req, ctx.orgId, ctx.tenantId, () => service.requestNotice(ids(req), req.body));
  sendResult(res, { request, warnings }, 201);
}));
router.delete("/notice/:id", asyncHandler(async (req: PortalRequest, res: Response) => {
  const n = await prisma.noticeRequest.findFirst({ where: { id: num(req.params.id), tenantId: { in: ids(req) } } });
  if (!n) throw new NotFoundError("Request not found");
  sendResult(res, await asTenant(req, Number(n.orgId), Number(n.tenantId), () => service.withdrawNotice(ids(req), Number(n.id))));
}));

export default router;
