import crypto from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/utils/errors";
import { PaymentService } from "../payment/payment.service";

// ---------- the workspace's store keys (encrypted at rest) ----------

export interface GatewayConfig { storeId: string; storePassEnc: string; sandbox: boolean }

const key = () => {
  if (!env.gateway.key && env.nodeEnv === "production") throw new ValidationError("Online payments need GATEWAY_KEY set on the server");
  // dev / test without GATEWAY_KEY: derive one so the feature still works locally
  return crypto.createHash("sha256").update(env.gateway.key || `${env.jwt.accessSecret}:gateway`).digest();
};
/** AES-256-GCM; "iv.tag.data", base64url. */
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}
export function decrypt(enc: string) {
  const [iv, tag, data] = enc.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

export const gatewaySchema = z.object({
  storeId: z.string().trim().min(3).max(100),
  /** empty keeps the saved password (the screen never shows it) */
  storePass: z.string().max(200).optional(),
  sandbox: z.boolean().default(true),
});
const asConfig = (g: unknown) => (g && typeof g === "object" && (g as GatewayConfig).storeId ? (g as GatewayConfig) : null);

export async function getGateway(orgId: number) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { gateway: true } });
  const g = asConfig(org.gateway);
  return { configured: !!g, storeId: g?.storeId ?? null, sandbox: g?.sandbox ?? true };
}

export async function saveGateway(orgId: number, input: z.infer<typeof gatewaySchema>) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { gateway: true } });
  const old = asConfig(org.gateway);
  if (!input.storePass && !old) throw new ValidationError("Enter the store password");
  const gateway: GatewayConfig = { storeId: input.storeId, storePassEnc: input.storePass ? encrypt(input.storePass) : old!.storePassEnc, sandbox: input.sandbox };
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: orgId }, data: { gateway: gateway as any } });
    await audit(tx, "settings.gateway", "Organization", orgId, { storeId: input.storeId, sandbox: input.sandbox, passwordChanged: !!input.storePass });
  });
  return getGateway(orgId);
}

export async function removeGateway(orgId: number) {
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: orgId }, data: { gateway: Prisma.DbNull } });
    await audit(tx, "settings.gateway", "Organization", orgId, { removed: true });
  });
  return getGateway(orgId);
}

// ---------- SSLCommerz calls ----------

const base = (g: GatewayConfig) => (g.sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com");

interface Validation { status: string; tran_id?: string; amount?: string; currency?: string; card_type?: string; bank_tran_id?: string; val_id?: string }

async function initSession(g: GatewayConfig, fields: Record<string, string>) {
  if (env.gateway.fake) return `https://sandbox.sslcommerz.com/fake-gateway?tran=${fields.tran_id}`; // test mode: never opened
  const body = new URLSearchParams({ store_id: g.storeId, store_passwd: decrypt(g.storePassEnc), ...fields });
  const r = await fetch(`${base(g)}/gwprocess/v4/api.php`, { method: "POST", body, signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => null)) as { status?: string; GatewayPageURL?: string; failedreason?: string } | null;
  if (j?.status !== "SUCCESS" || !j.GatewayPageURL) throw new ValidationError(`The payment gateway refused: ${j?.failedreason ?? `HTTP ${r.status}`}`);
  return j.GatewayPageURL;
}

async function validate(g: GatewayConfig, valId: string, op: { tranId: string; amount: unknown }): Promise<Validation> {
  if (env.gateway.fake) {
    return valId === `FAKE-${op.tranId}`
      ? { status: "VALID", tran_id: op.tranId, amount: String(op.amount), currency: "BDT", card_type: "BKASH-BKash", bank_tran_id: `FAKEBANK${op.tranId.slice(-6)}`, val_id: valId }
      : { status: "INVALID_TRANSACTION" };
  }
  const q = new URLSearchParams({ val_id: valId, store_id: g.storeId, store_passwd: decrypt(g.storePassEnc), format: "json" });
  const r = await fetch(`${base(g)}/validator/api/validationserverAPI.php?${q}`, { signal: AbortSignal.timeout(20_000) });
  return ((await r.json().catch(() => null)) as Validation | null) ?? { status: `HTTP ${r.status}` };
}

// ---------- checkout ----------

const payments = new PaymentService();

/** Start a checkout for the invoice behind a share link; returns the gateway page to send the tenant to. */
export async function startCheckout(token: string) {
  const inv = await prisma.invoice.findUnique({
    where: { shareToken: token },
    include: { org: { select: { gateway: true } }, tenant: { select: { firstName: true, lastName: true, phone: true, email: true } } },
  });
  if (!inv) throw new NotFoundError("Invoice not found");
  const g = asConfig(inv.org.gateway);
  if (!g) throw new ValidationError("This landlord does not take online payments yet");
  if (inv.carriedForward) throw new ValidationError("This bill was carried into a later one; open the latest bill to pay");
  const amount = Number(inv.dueAmount);
  if (amount <= 0) throw new ValidationError("Nothing is due on this bill");
  if (amount < 10) throw new ValidationError("Online payment needs at least ৳10");

  const tranId = `RH${inv.orgId}-${crypto.randomBytes(8).toString("hex")}`;
  await prisma.onlinePayment.create({ data: { orgId: inv.orgId, invoiceId: inv.id, tranId, amount } });
  const back = (r: string) => `${env.apiPublicUrl}/api/v1/public/pay/return/${tranId}?r=${r}`;
  const name = inv.tenant ? `${inv.tenant.firstName} ${inv.tenant.lastName}`.trim() : "Tenant";
  const url = await initSession(g, {
    total_amount: amount.toFixed(2),
    currency: "BDT",
    tran_id: tranId,
    success_url: back("success"),
    fail_url: back("fail"),
    cancel_url: back("cancel"),
    ipn_url: `${env.apiPublicUrl}/api/v1/public/pay/ipn`,
    cus_name: name || "Tenant",
    cus_email: inv.tenant?.email || "no-email@renthub.local",
    cus_phone: inv.tenant?.phone || "01700000000",
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: "1",
    product_name: `Rent and bills ${inv.month}/${inv.year}`,
    product_category: "Rent",
    product_profile: "non-physical-goods",
  });
  return { url, tranId };
}

/**
 * Settle a checkout after the gateway calls back (IPN) or the browser returns. Validates with SSLCommerz,
 * then records one ONLINE payment (receipt, SMS, audit through PaymentService). Safe to call twice.
 */
export async function settle(tranId: string, valId: string | undefined) {
  const op = await prisma.onlinePayment.findUnique({ where: { tranId }, include: { org: { select: { gateway: true } }, payment: { select: { shareToken: true } } } });
  if (!op) throw new NotFoundError("Unknown transaction");
  if (op.status === "PAID") return { paid: true, receiptToken: op.payment?.shareToken ?? null };
  const g = asConfig(op.org.gateway);
  if (!g || !valId) return fail(op.id, "FAILED", { reason: !g ? "gateway removed" : "no val_id" });

  const v = await validate(g, valId, op);
  const ok = (v.status === "VALID" || v.status === "VALIDATED") && v.tran_id === tranId && v.currency === "BDT" && Math.abs(Number(v.amount) - Number(op.amount)) < 0.01;
  if (!ok) return fail(op.id, "FAILED", v as any);

  // the bill may have been carried into a newer one since checkout began: the money goes there
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: op.invoiceId }, select: { id: true, carriedForward: true, agreementId: true } });
  const target = inv.carriedForward && inv.agreementId
    ? (await prisma.invoice.findFirst({ where: { agreementId: inv.agreementId, carriedForward: false }, orderBy: { periodStart: "desc" }, select: { id: true } }))?.id ?? inv.id
    : inv.id;
  try {
    const p = await payments.create(
      String(op.orgId),
      { invoiceId: Number(target), amount: Number(op.amount), method: "ONLINE", transactionId: v.bank_tran_id || tranId, remarks: `Online (${v.card_type ?? "SSLCommerz"}) ${tranId}` } as any,
      undefined,
      async (tx, pay) => {
        const { count } = await tx.onlinePayment.updateMany({
          where: { id: op.id, status: { not: "PAID" } },
          data: { status: "PAID", paymentId: pay.id, valId, cardType: v.card_type ?? null, bankTranId: v.bank_tran_id ?? null, raw: v as any },
        });
        if (!count) throw new ConflictError("already settled");
      },
    );
    return { paid: true, receiptToken: (p as { shareToken?: string | null }).shareToken ?? null };
  } catch (e) {
    if (e instanceof ConflictError) {
      const again = await prisma.onlinePayment.findUniqueOrThrow({ where: { id: op.id }, include: { payment: { select: { shareToken: true } } } });
      return { paid: true, receiptToken: again.payment?.shareToken ?? null };
    }
    throw e;
  }
}

async function fail(id: bigint, status: "FAILED" | "CANCELLED", raw: Record<string, unknown>) {
  await prisma.onlinePayment.updateMany({ where: { id, status: "INITIATED" }, data: { status, raw: raw as any } });
  return { paid: false, receiptToken: null };
}

/** The tenant cancelled or the gateway failed the payment (no money moved). */
export async function abandon(tranId: string, status: "FAILED" | "CANCELLED") {
  const op = await prisma.onlinePayment.findUnique({ where: { tranId } });
  if (op) await fail(op.id, status, { by: "return" });
}

/** The invoice share token for a transaction, to send the browser back to its bill. */
export const invoiceTokenOf = async (tranId: string) =>
  (await prisma.onlinePayment.findUnique({ where: { tranId }, select: { invoice: { select: { shareToken: true } } } }))?.invoice.shareToken ?? null;
