import crypto from "crypto";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { uploadsDir } from "../../shared/utils/upload";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/utils/errors";
import { depositBalance, ruleWarnings } from "../../shared/utils/rental";
import { AgreementService } from "../agreement/agreement.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { settingsOf } from "../org/org.service";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const claimSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(10_000_000),
  method: z.enum(["BKASH", "NAGAD", "ROCKET", "BANK", "CHEQUE"]),
  transactionId: z.string().trim().min(3).max(100),
  paidOn: day,
  note: z.string().trim().max(255).optional(),
});
export const noticeSchema = z.object({
  agreementId: z.coerce.number().int().positive(),
  moveOutDate: day,
  reason: z.string().trim().max(500).optional(),
});
export const maintenanceSchema = z.object({
  agreementId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(50).optional(),
});

const r2 = (n: number) => Math.round(n * 100) / 100;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const token = () => crypto.randomBytes(24).toString("base64url");

const agreements = new AgreementService();
const maintenance = new MaintenanceService();

/** Everything a tenant reads goes through these: the row must belong to one of the phone's tenants. */
export class PortalService {
  private async ownAgreement(tenantIds: number[], id: number) {
    const a = await prisma.agreement.findFirst({ where: { id, tenantId: { in: tenantIds }, status: { not: "DRAFT" } } });
    if (!a) throw new NotFoundError("Agreement not found");
    return a;
  }

  async home(tenantIds: number[]) {
    const rows = await prisma.agreement.findMany({
      where: { tenantId: { in: tenantIds }, status: { not: "DRAFT" } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      include: {
        org: { select: { id: true, name: true, settings: true } },
        tenant: { select: { id: true, firstName: true, lastName: true, lang: true } },
        revisions: { orderBy: { effectiveFrom: "asc" } },
        deposits: { select: { type: true, amount: true } },
        asset: { select: { unit: { select: { id: true, name: true, floor: { select: { name: true, building: { select: { name: true, address: true } } } } } } } },
        invoices: {
          where: { carriedForward: false, dueAmount: { gt: 0 } },
          orderBy: { periodStart: "desc" },
          select: { id: true, month: true, year: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, dueDate: true, shareToken: true },
        },
        notices: { where: { status: "PENDING" }, select: { id: true, moveOutDate: true, createdAt: true } },
      },
    });
    const live = (s: string) => s === "ACTIVE" || s === "NOTICE";
    rows.sort((a, b) => Number(live(b.status)) - Number(live(a.status)));
    // the latest open invoice gets a share link so the tenant can open it straight away
    for (const a of rows) {
      const inv = a.invoices[0];
      if (inv && !inv.shareToken) {
        inv.shareToken = token();
        await prisma.invoice.update({ where: { id: inv.id }, data: { shareToken: inv.shareToken } });
      }
    }
    const today = new Date();
    const claims = await prisma.paymentClaim.findMany({
      where: { tenantId: { in: tenantIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { invoice: { select: { month: true, year: true } }, payment: { select: { receiptNo: true, shareToken: true } } },
    });
    return {
      name: rows[0] ? `${rows[0].tenant.firstName} ${rows[0].tenant.lastName}` : "",
      lang: rows[0]?.tenant.lang ?? "BN",
      tenancies: rows.map((a) => ({
        agreementId: a.id,
        status: a.status,
        org: { id: a.org.id, name: a.org.name, payInfo: settingsOf(a.org.settings).payInfo },
        unit: a.asset.unit && { name: a.asset.unit.name, floorName: a.asset.unit.floor.name, building: a.asset.unit.floor.building },
        rent: Number([...a.revisions].reverse().find((r) => r.effectiveFrom <= today)?.rate ?? a.rate),
        dueDay: a.dueDay,
        startDate: a.startDate,
        endDate: a.endDate,
        depositBalance: depositBalance(a.deposits.map((d) => ({ type: d.type, amount: Number(d.amount) }))),
        openDues: r2(a.invoices.reduce((s, i) => s + Number(i.dueAmount), 0)),
        openInvoice: a.invoices[0] ?? null,
        pendingNotice: a.notices[0] ?? null,
      })),
      claims: claims.map(({ invoice, payment, ...c }) => ({ ...c, period: `${invoice.month}/${invoice.year}`, receipt: payment })),
    };
  }

  async invoices(tenantIds: number[], agreementId: number) {
    const a = await this.ownAgreement(tenantIds, agreementId);
    const rows = await prisma.invoice.findMany({
      where: { agreementId: a.id },
      orderBy: { periodStart: "desc" },
      select: { id: true, month: true, year: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, dueDate: true, carriedForward: true, shareToken: true },
    });
    for (const r of rows.filter((x) => !x.shareToken)) {
      r.shareToken = token();
      await prisma.invoice.update({ where: { id: r.id }, data: { shareToken: r.shareToken } });
    }
    return rows;
  }

  async payments(tenantIds: number[], agreementId: number) {
    const a = await this.ownAgreement(tenantIds, agreementId);
    return prisma.payment.findMany({
      where: { invoice: { agreementId: a.id } },
      orderBy: { date: "desc" },
      select: { id: true, receiptNo: true, amount: true, method: true, transactionId: true, date: true, shareToken: true, invoice: { select: { month: true, year: true } } },
    });
  }

  /** The agreement as the staff app sees it, plus what the printed deed needs. */
  async agreement(tenantIds: number[], id: number) {
    const a = await this.ownAgreement(tenantIds, id);
    const detail = await agreements.get(Number(a.orgId), String(a.id));
    const [org, building] = await Promise.all([
      prisma.organization.findUnique({ where: { id: a.orgId }, select: { name: true } }),
      detail.unit ? prisma.building.findUnique({ where: { id: detail.unit.building.id }, select: { name: true, address: true, holdingNumber: true, area: true } }) : null,
    ]);
    const { invoices, ...rest } = detail;
    return { ...rest, landlordName: org?.name ?? "", building };
  }

  // ─── maintenance ───

  async listMaintenance(tenantIds: number[]) {
    const rows = await prisma.maintenanceRequest.findMany({
      where: { tenantId: { in: tenantIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        asset: { select: { unit: { select: { name: true, floor: { select: { building: { select: { name: true } } } } } } } },
        photos: { select: { id: true } },
      },
    });
    return rows.map(({ asset, ...r }) => ({
      id: r.id, title: r.title, description: r.description, category: r.category, status: r.status, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
      unit: asset.unit ? `${asset.unit.name}, ${asset.unit.floor.building.name}` : null,
      photos: r.photos.map((p) => p.id),
    }));
  }

  async createMaintenance(tenantIds: number[], input: z.infer<typeof maintenanceSchema>) {
    const a = await this.ownAgreement(tenantIds, input.agreementId);
    if (a.status !== "ACTIVE" && a.status !== "NOTICE") throw new ValidationError("This tenancy has ended");
    const flat = await prisma.flat.findUnique({ where: { assetId: a.assetId }, select: { id: true } });
    if (!flat) throw new ValidationError("Only units can have maintenance requests");
    const r = await maintenance.create(Number(a.orgId), null, { flatId: Number(flat.id), title: input.title, description: input.description, category: input.category });
    return { id: r.id, orgId: Number(a.orgId), tenantId: Number(a.tenantId) };
  }

  async ownMaintenance(tenantIds: number[], id: number) {
    const r = await prisma.maintenanceRequest.findFirst({ where: { id, tenantId: { in: tenantIds } } });
    if (!r) throw new NotFoundError("Request not found");
    return r;
  }

  async addPhotos(tenantIds: number[], id: number, files: Express.Multer.File[]) {
    const r = await this.ownMaintenance(tenantIds, id);
    await maintenance.addPhotos(Number(r.orgId), null, Number(r.id), files);
    return { id: r.id };
  }

  /** A photo on one of the tenant's own requests. */
  async file(tenantIds: number[], id: number) {
    const doc = await prisma.document.findFirst({ where: { id, maintenance: { tenantId: { in: tenantIds } } } });
    if (!doc) throw new NotFoundError("File not found");
    const abs = path.join(uploadsDir, path.basename(doc.path));
    if (!fs.existsSync(abs)) throw new NotFoundError("File not found");
    return { doc, abs };
  }

  // ─── "I paid" claims ───

  async createClaim(tenantIds: number[], input: z.infer<typeof claimSchema>) {
    const inv = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, agreement: { tenantId: { in: tenantIds } } },
      include: { agreement: { select: { tenantId: true } } },
    });
    if (!inv) throw new NotFoundError("Invoice not found");
    if (inv.carriedForward) throw new ValidationError("This bill was added to a later one; pay the latest bill instead");
    if (Number(inv.dueAmount) <= 0) throw new ValidationError("This bill is already paid");
    const pending = await prisma.paymentClaim.findFirst({ where: { invoiceId: inv.id, status: "PENDING", transactionId: input.transactionId } });
    if (pending) throw new ConflictError("You already reported this payment");
    try {
      return await prisma.$transaction(async (tx) => {
        const c = await tx.paymentClaim.create({
          data: {
            orgId: inv.orgId,
            invoiceId: inv.id,
            tenantId: inv.agreement!.tenantId,
            amount: input.amount,
            method: input.method,
            transactionId: input.transactionId,
            paidOn: new Date(`${input.paidOn}T00:00:00Z`),
            note: input.note,
          },
        });
        await audit(tx, "claim.submit", "PaymentClaim", c.id, { invoiceId: Number(inv.id), amount: input.amount, method: input.method, transactionId: input.transactionId });
        return c;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ConflictError("This transaction ID was already reported");
      throw e;
    }
  }

  async claimContext(tenantIds: number[], invoiceId: number) {
    const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, agreement: { tenantId: { in: tenantIds } } }, select: { orgId: true, agreement: { select: { tenantId: true } } } });
    if (!inv) throw new NotFoundError("Invoice not found");
    return { orgId: Number(inv.orgId), tenantId: Number(inv.agreement!.tenantId) };
  }

  // ─── notice ───

  async requestNotice(tenantIds: number[], input: z.infer<typeof noticeSchema>) {
    const a = await this.ownAgreement(tenantIds, input.agreementId);
    if (a.status !== "ACTIVE") throw new ValidationError(a.status === "NOTICE" ? "Notice has already been given" : "This tenancy has ended");
    const today = new Date(`${ymd(new Date())}T00:00:00Z`);
    const moveOutDate = new Date(`${input.moveOutDate}T00:00:00Z`);
    if (moveOutDate <= today) throw new ValidationError("Choose a move-out date in the future");
    if (await prisma.noticeRequest.count({ where: { agreementId: a.id, status: "PENDING" } })) throw new ConflictError("You already asked to move out; wait for the owner's answer or withdraw it");
    const warnings = ruleWarnings({ rate: Number(a.rate), noticeDate: today, endDate: moveOutDate, noticeDays: a.noticeDays });
    const n = await prisma.$transaction(async (tx) => {
      const n = await tx.noticeRequest.create({ data: { orgId: a.orgId, agreementId: a.id, tenantId: a.tenantId, noticeDate: today, moveOutDate, reason: input.reason } });
      await audit(tx, "notice.request", "Agreement", a.id, { moveOutDate: input.moveOutDate });
      return n;
    });
    return { request: n, warnings, orgId: Number(a.orgId), tenantId: Number(a.tenantId) };
  }

  async noticeContext(tenantIds: number[], agreementId: number) {
    const a = await this.ownAgreement(tenantIds, agreementId);
    return { orgId: Number(a.orgId), tenantId: Number(a.tenantId) };
  }

  async withdrawNotice(tenantIds: number[], id: number) {
    const n = await prisma.noticeRequest.findFirst({ where: { id, tenantId: { in: tenantIds } } });
    if (!n) throw new NotFoundError("Request not found");
    const { count } = await prisma.noticeRequest.updateMany({ where: { id: n.id, status: "PENDING" }, data: { status: "WITHDRAWN", reviewedAt: new Date() } });
    if (!count) throw new ValidationError("The owner has already answered this request");
    await audit(prisma, "notice.withdraw", "Agreement", n.agreementId);
    return { id: n.id };
  }
}
