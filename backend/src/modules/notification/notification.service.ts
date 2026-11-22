import crypto from "node:crypto";
import { expiringDocs } from "../document/document.service";
import { expiryStage } from "../../shared/notify/expiry";
import { Prisma, Lang } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { env } from "../../config/env";
import { NotFoundError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { normalizeBdPhone } from "../../shared/notify/phone";
import { render, smsSegments, TEMPLATE_KEYS, SAMPLE, type TemplateKey, type TemplateData } from "../../shared/notify/templates";
import { reminderFor } from "../../shared/notify/collect";
import { settingsOf } from "../org/org.service";
import { sendSms } from "./sms.sender";
import { assetVehicle, unitName, unitPlace } from "../../shared/utils/asset";

type Tx = Prisma.TransactionClient | typeof prisma;
const BACKOFF_MIN = [5, 30, 120]; // retry after a failed send
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface EnqueueInput {
  orgId: bigint | number;
  template: TemplateKey;
  to: string | null | undefined;
  lang: Lang;
  data: TemplateData;
  invoiceId?: bigint | number;
  paymentId?: bigint | number;
  dedupeKey?: string;
}

/**
 * Outbox write. Call it inside the business transaction so a message exists exactly when the
 * payment/invoice does. Sending happens later in drain(). A repeated dedupeKey is ignored.
 */
export async function enqueue(tx: Tx, n: EnqueueInput) {
  const to = normalizeBdPhone(n.to);
  // cheap check first (keeps the log quiet); the unique index below still settles races
  if (n.dedupeKey && (await tx.notification.findUnique({ where: { dedupeKey: n.dedupeKey }, select: { id: true } }))) return false;
  try {
    await tx.notification.create({
      data: {
        orgId: n.orgId,
        template: n.template,
        to,
        lang: n.lang,
        payload: n.data as any,
        body: render(n.template, n.lang, n.data),
        status: to ? "QUEUED" : "SKIPPED",
        lastError: to ? null : n.to ? `Not a Bangladeshi mobile number: ${n.to}` : "No phone number",
        invoiceId: n.invoiceId,
        paymentId: n.paymentId,
        dedupeKey: n.dedupeKey,
      },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; // already queued
    throw e;
  }
}

/** Send queued messages that are due. Runs every minute from the cron process. */
export async function drain(limit = 50) {
  const due = await prisma.notification.findMany({
    where: { status: "QUEUED", sendAfter: { lte: new Date() } },
    orderBy: { sendAfter: "asc" },
    take: limit,
    include: { org: { select: { settings: true } } },
  });
  let sent = 0;
  for (const n of due) {
    if (!settingsOf(n.org.settings).sms.enabled) {
      await prisma.notification.update({ where: { id: n.id }, data: { status: "SKIPPED", lastError: "SMS is turned off for this organisation" } });
      continue;
    }
    const r = await sendSms(n.to!, n.body ?? render(n.template as TemplateKey, n.lang, n.payload as any));
    const attempts = n.attempts + 1;
    await prisma.notification.update({
      where: { id: n.id },
      data: r.ok
        ? { status: "SENT", sentAt: new Date(), attempts, lastError: null }
        : {
            attempts,
            lastError: r.error,
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
            sendAfter: new Date(Date.now() + (BACKOFF_MIN[attempts - 1] ?? 0) * 60_000),
          },
    });
    if (r.ok) sent++;
  }
  return { picked: due.length, sent };
}

const invoiceForReminder = {
  tenant: { select: { phone: true, lang: true } },
  flat: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } },
  asset: assetVehicle,
  org: { select: { name: true } },
} satisfies Prisma.InvoiceInclude;

type ReminderInvoice = Prisma.InvoiceGetPayload<{ include: typeof invoiceForReminder }>;

async function shareLink(inv: { id: bigint; shareToken: string | null }) {
  const token = inv.shareToken ?? crypto.randomBytes(24).toString("base64url");
  if (!inv.shareToken) await prisma.invoice.update({ where: { id: inv.id }, data: { shareToken: token } });
  return `${env.appUrl}/i/${token}`;
}

async function queueReminder(inv: ReminderInvoice, template: Exclude<TemplateKey, "RECEIPT">, dedupeKey?: string) {
  await enqueue(prisma, {
    orgId: inv.orgId,
    template,
    to: inv.tenant?.phone,
    lang: inv.tenant?.lang ?? "BN",
    invoiceId: inv.id,
    dedupeKey,
    data: {
      org: inv.org.name,
      unit: unitPlace(inv),
      amount: Number(inv.dueAmount),
      month: `${inv.year}-${String(inv.month).padStart(2, "0")}`,
      dueDate: inv.dueDate ? ymd(inv.dueDate) : undefined,
      link: await shareLink(inv),
    },
  });
}

/** Daily: queue the reminder each open invoice is due for today (5th, due day, 3 days late). */
export async function queueDailyReminders(today = new Date()) {
  const orgs = await prisma.organization.findMany({ select: { id: true, settings: true } });
  let queued = 0;
  for (const org of orgs) {
    const s = settingsOf(org.settings);
    if (!s.sms.enabled || !s.sms.reminders) continue;
    const template = reminderFor(today, s.dueDay);
    if (!template) continue;
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: org.id,
        carriedForward: false,
        dueAmount: { gt: 0 },
        status: template === "OVERDUE" ? "OVERDUE" : { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
        // drivers pay jama in person every day: no rent reminders for daily agreements
        NOT: { agreement: { cycle: "DAILY" } },
        // trip bills get their own SMS (TRIP_BILL), not the monthly rent schedule
        booking: { is: null },
      },
      include: invoiceForReminder,
    });
    for (const inv of invoices) {
      await queueReminder(inv, template, `${template}:${inv.id}:${ymd(today)}`);
      queued++;
    }
  }
  return { queued };
}

/** Daily: SMS the workspace owner about documents expiring in 30 days, in 7 days, or today. */
export async function queueExpiryReminders(today: Date) {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true, name: true, settings: true,
      memberships: { where: { role: "OWNER", isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { user: { select: { phone: true } } } },
    },
  });
  let queued = 0;
  for (const org of orgs) {
    const phone = org.memberships[0]?.user.phone;
    if (!settingsOf(org.settings).sms.enabled || !phone) continue;
    for (const d of await expiringDocs(Number(org.id), 30, today)) {
      const stage = expiryStage(d.expiresAt!, today);
      if (stage === null) continue;
      const expiresOn = ymd(d.expiresAt!);
      const added = await enqueue(prisma, {
        orgId: org.id,
        template: "DOC_EXPIRY",
        to: phone,
        // ponytail: owner SMS in Bangla; add an owner language setting if asked
        lang: "BN",
        // a renewal has another expiry date, so it is reminded afresh
        dedupeKey: `doc:${d.id}:${expiresOn}:${stage}`,
        data: { org: org.name, unit: d.owner?.label ?? "", amount: 0, document: d.name, expiresOn, daysLeft: stage },
      });
      if (added) queued++;
    }
  }
  return { queued };
}

export class NotificationService {
  async list(orgId: number, q: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
    const where: Prisma.NotificationWhereInput = { orgId, ...(q.status && { status: q.status as any }) };
    const [data, total, counts] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.notification.count({ where }),
      prisma.notification.groupBy({ by: ["status"], where: { orgId }, _count: true }),
    ]);
    return {
      data: data.map((n) => ({ ...n, segments: n.body ? smsSegments(n.body) : 0 })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) },
    };
  }

  async retry(orgId: number, id: string) {
    const n = await prisma.notification.findFirst({ where: { id: toNumberId(id), orgId } });
    if (!n) throw new NotFoundError("Message not found");
    if (n.status === "SENT") throw new ValidationError("Already sent");
    if (!n.to) throw new ValidationError("No valid phone number to send to");
    return prisma.notification.update({ where: { id: n.id }, data: { status: "QUEUED", attempts: 0, sendAfter: new Date(), lastError: null } });
  }

  preview() {
    return TEMPLATE_KEYS.map((key) => ({
      key,
      BN: render(key, "BN", SAMPLE),
      EN: render(key, "EN", SAMPLE),
    }));
  }

  /** "Send reminder" on an invoice: due-today wording before/at the due date, overdue after. */
  async remindInvoice(orgId: number, invoiceId: string) {
    const inv = await prisma.invoice.findFirst({ where: { id: toNumberId(invoiceId), orgId }, include: invoiceForReminder });
    if (!inv) throw new NotFoundError("Invoice not found");
    if (inv.carriedForward || Number(inv.dueAmount) <= 0) throw new ValidationError("Nothing is due on this invoice");
    await queueReminder(inv, inv.status === "OVERDUE" ? "OVERDUE" : "RENT_DUE");
    return { queued: true, to: normalizeBdPhone(inv.tenant?.phone) };
  }
}
