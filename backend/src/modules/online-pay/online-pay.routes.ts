import { Router, Request, Response } from "express";
import { env } from "../../config/env";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { permit, requireOrg } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { globalRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { abandon, gatewaySchema, getGateway, invoiceTokenOf, removeGateway, saveGateway, settle, startCheckout } from "./online-pay.service";

/** Public: the tenant pays from the invoice link; SSLCommerz calls back here. */
export const publicPayRouter = Router();

publicPayRouter.post("/ipn", asyncHandler(async (req: Request, res: Response) => {
  // server-to-server; answer 200 whatever happens so the gateway does not hammer us (the outcome is in online_payments)
  const { tran_id, val_id, status } = req.body ?? {};
  if (typeof tran_id === "string") {
    if (status === "VALID" || status === "VALIDATED") await settle(tran_id, val_id).catch((e) => console.error("[Pay] IPN settle failed:", e));
    else if (status === "FAILED" || status === "CANCELLED") await abandon(tran_id, status);
  }
  res.status(200).send("OK");
}));

/** The browser comes back from the gateway (it POSTs a form): settle, then send it to the receipt or back to the bill. */
publicPayRouter.post("/return/:tranId", asyncHandler(async (req: Request, res: Response) => {
  const tranId = req.params.tranId;
  const token = await invoiceTokenOf(tranId);
  const bill = (why: string) => `${env.appUrl}/i/${token ?? ""}?pay=${why}`;
  if (req.query.r !== "success") {
    await abandon(tranId, req.query.r === "cancel" ? "CANCELLED" : "FAILED");
    res.redirect(303, bill(req.query.r === "cancel" ? "cancelled" : "failed"));
    return;
  }
  const out = await settle(tranId, req.body?.val_id).catch((e) => { console.error("[Pay] return settle failed:", e); return null; });
  res.redirect(303, out?.paid && out.receiptToken ? `${env.appUrl}/r/${out.receiptToken}` : bill("failed"));
}));

publicPayRouter.post("/:token", globalRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  sendResult(res, await startCheckout(req.params.token), 201);
}));

/** Staff: the workspace's SSLCommerz store (OWNER; the password is never returned). */
export const gatewayRouter = Router();
gatewayRouter.use(authenticate, requireOrg, permit("settings:write"));
gatewayRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => { sendResult(res, await getGateway(req.org!.id)); }));
gatewayRouter.put("/", validate(gatewaySchema), asyncHandler(async (req: AuthRequest, res: Response) => { sendResult(res, await saveGateway(req.org!.id, req.body)); }));
gatewayRouter.delete("/", asyncHandler(async (req: AuthRequest, res: Response) => { sendResult(res, await removeGateway(req.org!.id)); }));
