import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../../middleware/auth.middleware";
import { requireOrg, writes } from "../../middleware/org.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendResult } from "../../shared/utils/apiResponse";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { env } from "../../config/env";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { PaymentService } from "../payment/payment.service";
import { enqueue } from "../notification/notification.service";
import { assetVehicle, unitName, unitPlace } from "../../shared/utils/asset";

const payments = new PaymentService();
const confirmSchema = z.object({ amount: z.coerce.number().positive().max(10_000_000).optional() });
const rejectSchema = z.object({ reason: z.string().trim().min(1).max(255) });

const include = {
  tenant: { select: { id: true, firstName: true, lastName: true, phone: true, lang: true } },
  invoice: { select: { id: true, month: true, year: true, dueAmount: true, carriedForward: true, flat: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } }, asset: assetVehicle } },
  reviewedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
  payment: { select: { id: true, receiptNo: true } },
} as const;

async function own(orgId: number, id: number) {
  const c = await prisma.paymentClaim.findFirst({ where: { id, orgId }, include });
  if (!c) throw new NotFoundError("Claim not found");
  return c;
}

/** "I paid" claims from the tenant portal, for staff to confirm (records the payment) or reject. */
const router = Router();
router.use(authenticate, requireOrg, writes("payment:write"));

router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = ["PENDING", "CONFIRMED", "REJECTED"].includes(String(req.query.status)) ? (String(req.query.status) as any) : undefined;
  const [rows, pending] = await Promise.all([
    prisma.paymentClaim.findMany({ where: { orgId: req.org!.id, ...(status && { status }) }, include, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.paymentClaim.count({ where: { orgId: req.org!.id, status: "PENDING" } }),
  ]);
  sendResult(res, { data: rows, meta: { pending } });
}));

router.post("/:id/confirm", validate(confirmSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const c = await own(req.org!.id, Number(req.params.id));
  if (c.status !== "PENDING") throw new ValidationError("This claim was already answered");
  const amount = req.body.amount ?? Number(c.amount);
  // the claim flips to CONFIRMED in the same transaction as the payment; a second click finds it already answered
  const payment = await payments.create(
    String(req.org!.id),
    {
      invoiceId: Number(c.invoiceId),
      amount,
      method: c.method,
      transactionId: c.transactionId,
      date: c.paidOn.toISOString().slice(0, 10),
      remarks: `Reported by the tenant in the portal${c.note ? `: ${c.note}` : ""}`,
    } as any,
    req.org!.membershipId,
    async (tx, p) => {
      const { count } = await tx.paymentClaim.updateMany({
        where: { id: c.id, status: "PENDING" },
        data: { status: "CONFIRMED", paymentId: p.id, reviewedById: req.org!.membershipId, reviewedAt: new Date() },
      });
      if (!count) throw new ValidationError("This claim was already answered");
      await audit(tx, "claim.confirm", "PaymentClaim", c.id, { paymentId: Number(p.id), amount, transactionId: c.transactionId });
    }
  );
  sendResult(res, { claim: await own(req.org!.id, Number(c.id)), payment });
}));

router.post("/:id/reject", validate(rejectSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const c = await own(req.org!.id, Number(req.params.id));
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.paymentClaim.updateMany({
      where: { id: c.id, status: "PENDING" },
      data: { status: "REJECTED", reviewNote: req.body.reason, reviewedById: req.org!.membershipId, reviewedAt: new Date() },
    });
    if (!count) throw new ValidationError("This claim was already answered");
    const org = await tx.organization.findUniqueOrThrow({ where: { id: c.orgId }, select: { name: true } });
    await enqueue(tx, {
      orgId: Number(c.orgId),
      template: "CLAIM_REJECTED",
      to: c.tenant.phone,
      lang: c.tenant.lang,
      invoiceId: c.invoiceId,
      data: {
        org: org.name,
        unit: unitPlace(c.invoice),
        amount: Number(c.amount),
        reference: `${c.method} ${c.transactionId}`,
        reason: req.body.reason,
        link: `${env.appUrl}/portal`,
      },
    });
    await audit(tx, "claim.reject", "PaymentClaim", c.id, { reason: req.body.reason, transactionId: c.transactionId });
  });
  sendResult(res, await own(req.org!.id, Number(c.id)));
}));

export default router;
