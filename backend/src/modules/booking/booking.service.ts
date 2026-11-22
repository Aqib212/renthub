import crypto from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../shared/prisma";
import { audit } from "../../shared/audit";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/utils/errors";
import { tripCharge, type TripInput } from "../../shared/utils/rental";
import { vehicleLabel } from "../../shared/utils/asset";
import { LIVE } from "../bill-type/bill-type.service";
import { recalculateInvoice } from "../invoice/invoice.service";
import { enqueue } from "../notification/notification.service";
import { PaymentService } from "../payment/payment.service";
import { syncAssetStatus } from "../agreement/agreement.service";
import { partyFields } from "../agreement/agreement.validation";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;
const BD = 6 * 3_600_000; // Bangladesh is UTC+6
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
/** The Bangladesh calendar day of an instant, as a UTC midnight (what @db.Date columns hold). */
const bdDate = (d: Date) => new Date(Math.floor((d.getTime() + BD) / DAY) * DAY);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const when = z.coerce.date();
const money = z.coerce.number().min(0);
const extras = z.array(z.object({ label: z.string().trim().max(100), amount: z.coerce.number() })).max(30);
const terms = {
  vehicleId: z.coerce.number().int().positive(),
  driverName: z.string().trim().max(100).nullable().optional(),
  driverPhone: z.string().trim().max(20).nullable().optional(),
  pickup: z.string().trim().max(255).nullable().optional(),
  destination: z.string().trim().max(255).nullable().optional(),
  outstation: z.boolean().optional(),
  startAt: when,
  endAt: when,
  dayRate: z.coerce.number().positive().optional(), // defaults to the vehicle's asking rate
  hourCap: z.coerce.number().int().min(1).max(24).optional(),
  kmCap: z.coerce.number().int().min(1).nullable().optional(),
  overtimeRate: money.optional(),
  extraKmRate: money.optional(),
  fuelPerKm: money.optional(),
  notes: z.string().max(5000).nullable().optional(),
};
export const createBookingSchema = z
  .object({
    ...terms,
    tenantId: z.coerce.number().int().positive().optional(),
    customer: z.object({ ...partyFields, lastName: z.string().max(100).default("") }).optional(),
    advance: z.object({ amount: z.coerce.number().positive(), method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "CHEQUE"]), transactionId: z.string().max(100).optional() }).optional(),
  })
  .refine((v) => v.tenantId || v.customer, { message: "Choose a customer or enter one", path: ["tenantId"] })
  .refine((v) => v.endAt > v.startAt, { message: "The trip must end after it starts", path: ["endAt"] });
export const updateBookingSchema = z.object(terms).partial();
export const startSchema = z.object({ startKm: z.coerce.number().int().min(0), startedAt: when.optional() });
export const sheetSchema = z.object({ endKm: z.coerce.number().int().min(0).nullable().optional(), endedAt: when.nullable().optional(), extras: extras.optional() });
export const cancelSchema = z.object({ charge: money.optional() });
export const listSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  status: z.enum(["RESERVED", "ON_TRIP", "DONE", "CANCELLED"]).optional(),
});

const include = {
  vehicle: { select: { id: true, regNo: true, type: true, model: true, assetId: true } },
  tenant: { select: { id: true, firstName: true, lastName: true, phone: true, kind: true, lang: true } },
  invoice: { select: { id: true, month: true, year: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, shareToken: true } },
} satisfies Prisma.BookingInclude;
type Row = Prisma.BookingGetPayload<{ include: typeof include }>;

const tripOf = (b: Prisma.BookingGetPayload<{}>): TripInput => ({
  startAt: b.startAt, endAt: b.endAt, startedAt: b.startedAt, endedAt: b.endedAt,
  dayRate: n(b.dayRate), hourCap: b.hourCap, kmCap: b.kmCap, overtimeRate: n(b.overtimeRate), extraKmRate: n(b.extraKmRate), fuelPerKm: n(b.fuelPerKm),
  startKm: b.startKm, endKm: b.endKm, extras: (b.extras as TripInput["extras"]) ?? [],
});

const shape = (b: Row) => ({
  ...b,
  customer: `${b.tenant.firstName} ${b.tenant.lastName}`.trim(),
  vehicleLabel: vehicleLabel(b.vehicle),
  charge: tripCharge(tripOf(b)),
});

/** Re-price the booking's invoice from its terms and trip sheet (or the cancellation charge). */
async function rebuildBookingInvoice(tx: Tx, bookingId: bigint) {
  const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!b.invoiceId) return;
  const lines = b.status === "CANCELLED"
    ? [{ label: "Cancellation charge", detail: null, quantity: null, rate: null, amount: n(b.cancelCharge) }]
    : tripCharge(tripOf(b)).items;
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: b.invoiceId } });
  await tx.invoiceItem.deleteMany({ where: { invoiceId: b.invoiceId } });
  await tx.invoiceItem.createMany({ data: lines.map((l, i) => ({ ...l, invoiceId: b.invoiceId!, sortOrder: i })) });
  await tx.invoice.update({
    where: { id: b.invoiceId },
    data: {
      rent: lines[0]?.label === "Body rent" ? lines[0].amount : 0,
      totalAmount: Math.max(0, Math.round((total - n(inv.discount) + n(inv.fine)) * 100) / 100),
      periodStart: bdDate(b.startedAt ?? b.startAt),
      periodEnd: bdDate(b.endedAt ?? b.endAt),
      dueDate: bdDate(b.endedAt ?? b.endAt),
    },
  });
  await recalculateInvoice(b.invoiceId, tx);
}

export class BookingService {
  private payments = new PaymentService();

  private async own(orgId: number, id: number) {
    const b = await prisma.booking.findFirst({ where: { id, orgId }, include });
    if (!b) throw new NotFoundError("Booking not found");
    return b;
  }

  /** No other booking on the vehicle in the window, and no driver lease running then. */
  private async assertFree(tx: Tx, vehicle: { id: bigint; assetId: bigint }, start: Date, end: Date, self?: bigint) {
    const b = await tx.booking.findFirst({
      where: { vehicleId: vehicle.id, status: { not: "CANCELLED" }, startAt: { lt: end }, endAt: { gt: start }, ...(self ? { id: { not: self } } : {}) },
      include: { tenant: { select: { firstName: true, lastName: true } } },
    });
    if (b) throw new ConflictError(`The vehicle is booked by ${b.tenant.firstName} ${b.tenant.lastName} (${ymd(bdDate(b.startAt))} to ${ymd(bdDate(b.endAt))})`);
    const a = await tx.agreement.findFirst({
      where: { assetId: vehicle.assetId, ...LIVE, startDate: { lte: bdDate(end) }, OR: [{ endDate: null }, { endDate: { gte: bdDate(start) } }] },
      include: { tenant: { select: { firstName: true, lastName: true } } },
    });
    if (a) throw new ConflictError(`The vehicle is leased to ${a.tenant.firstName} ${a.tenant.lastName}; end that lease first`);
  }

  async list(orgId: number, q: z.infer<typeof listSchema>) {
    const from = q.from ? new Date(new Date(`${q.from}T00:00:00Z`).getTime() - BD) : undefined;
    const to = q.to ? new Date(new Date(`${q.to}T00:00:00Z`).getTime() + DAY - BD) : undefined;
    const rows = await prisma.booking.findMany({
      where: {
        orgId,
        ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(to ? { startAt: { lt: to } } : {}),
        ...(from ? { endAt: { gt: from } } : {}),
      },
      include,
      orderBy: { startAt: "asc" },
      take: 500,
    });
    return rows.map(shape);
  }

  async get(orgId: number, id: number) {
    return shape(await this.own(orgId, id));
  }

  async create(orgId: number, membershipId: number | undefined, input: z.infer<typeof createBookingSchema>) {
    const v = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, orgId } });
    if (!v) throw new NotFoundError("Vehicle not found");
    if (v.status === "OFF_ROAD") throw new ValidationError("The vehicle is off the road for repairs");
    if (input.tenantId && !(await prisma.tenant.count({ where: { id: input.tenantId, orgId } }))) throw new NotFoundError("Customer not found");
    const dayRate = input.dayRate ?? n(v.rate);
    if (!dayRate) throw new ValidationError("Enter the body rent per day (this vehicle has no asking rate)");
    const { tenantId: _t, customer, advance, vehicleId, ...t } = input;

    const id = await prisma.$transaction(async (tx) => {
      await this.assertFree(tx, v, input.startAt, input.endAt);
      const tenantId = input.tenantId ? BigInt(input.tenantId) : (await tx.tenant.create({ data: { ...customer!, email: customer!.email || null, orgId } })).id;
      const start = bdDate(input.startAt);
      const inv = await tx.invoice.create({
        data: { orgId, tenantId, assetId: v.assetId, month: start.getUTCMonth() + 1, year: start.getUTCFullYear(), totalAmount: 0, dueAmount: 0, notes: "Rent-a-car trip" },
      });
      const b = await tx.booking.create({ data: { ...t, dayRate, orgId, vehicleId: v.id, tenantId, invoiceId: inv.id, createdById: membershipId ?? null } });
      await rebuildBookingInvoice(tx, b.id);
      await audit(tx, "booking.create", "Booking", b.id, { vehicle: v.regNo, from: ymd(start), to: ymd(bdDate(input.endAt)), dayRate });
      return b.id;
    });

    if (advance) {
      const b = await prisma.booking.findUniqueOrThrow({ where: { id } });
      await this.payments.create(String(orgId), { invoiceId: Number(b.invoiceId), amount: advance.amount, method: advance.method, transactionId: advance.transactionId, remarks: "Booking advance" } as any, membershipId);
    }
    const b = await this.own(orgId, Number(id));
    await this.notify(b, "BOOKING_CONFIRMED");
    return shape(await this.own(orgId, Number(id)));
  }

  async update(orgId: number, id: number, input: z.infer<typeof updateBookingSchema>) {
    const b = await this.own(orgId, id);
    if (b.status !== "RESERVED") throw new ValidationError("Only a reserved booking can be changed; use the trip sheet once the trip has started");
    const v = input.vehicleId ? await prisma.vehicle.findFirst({ where: { id: input.vehicleId, orgId } }) : b.vehicle;
    if (!v) throw new NotFoundError("Vehicle not found");
    const start = input.startAt ?? b.startAt;
    const end = input.endAt ?? b.endAt;
    if (end <= start) throw new ValidationError("The trip must end after it starts");
    await prisma.$transaction(async (tx) => {
      await this.assertFree(tx, { id: BigInt(v.id), assetId: v.assetId }, start, end, b.id);
      await tx.booking.update({ where: { id: b.id }, data: input });
      if (input.vehicleId && b.invoiceId) await tx.invoice.update({ where: { id: b.invoiceId }, data: { assetId: v.assetId } });
      await rebuildBookingInvoice(tx, b.id);
      await audit(tx, "booking.update", "Booking", b.id, { vehicle: b.vehicle.regNo });
    });
    return this.get(orgId, id);
  }

  async start(orgId: number, id: number, input: z.infer<typeof startSchema>) {
    const b = await this.own(orgId, id);
    if (b.status !== "RESERVED") throw new ValidationError("This trip has already started or is closed");
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { id: b.vehicleId } });
    if (v.status === "OFF_ROAD" || v.status === "ON_TRIP") throw new ConflictError(v.status === "OFF_ROAD" ? "The vehicle is off the road for repairs" : "The vehicle is out on another trip");
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: "ON_TRIP", startKm: input.startKm, startedAt: input.startedAt ?? new Date() } });
      await tx.vehicle.update({ where: { id: b.vehicleId }, data: { status: "ON_TRIP" } });
      await rebuildBookingInvoice(tx, b.id);
      await audit(tx, "booking.start", "Booking", b.id, { vehicle: b.vehicle.regNo, startKm: input.startKm });
    });
    return this.get(orgId, id);
  }

  /** Save the trip sheet; `close` also ends the trip, frees the vehicle and sends the bill. */
  async sheet(orgId: number, id: number, input: z.infer<typeof sheetSchema>, close = false) {
    const b = await this.own(orgId, id);
    if (b.status !== "ON_TRIP") throw new ValidationError(b.status === "RESERVED" ? "Start the trip first" : "This trip is closed");
    const endKm = input.endKm === undefined ? b.endKm : input.endKm;
    const endedAt = input.endedAt === undefined ? b.endedAt : input.endedAt;
    if (close && endKm == null) throw new ValidationError("Enter the end km reading");
    if (endKm != null && b.startKm != null && endKm < b.startKm) throw new ValidationError(`End km is below the start reading (${b.startKm})`);
    if (endedAt && b.startedAt && endedAt <= b.startedAt) throw new ValidationError("The trip must end after it started");
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: b.id },
        data: { endKm, endedAt: close ? endedAt ?? new Date() : endedAt, ...(input.extras ? { extras: input.extras } : {}), ...(close ? { status: "DONE" } : {}) },
      });
      await rebuildBookingInvoice(tx, b.id);
      if (close) {
        await tx.vehicle.updateMany({ where: { id: b.vehicleId, status: "ON_TRIP" }, data: { status: "AVAILABLE" } });
        await syncAssetStatus(b.vehicle.assetId, tx);
        await audit(tx, "booking.close", "Booking", b.id, { vehicle: b.vehicle.regNo, km: endKm != null && b.startKm != null ? endKm - b.startKm : null });
      }
    });
    const after = await this.own(orgId, id);
    if (close) await this.notify(after, "TRIP_BILL");
    return shape(after);
  }

  /** Cancel: the invoice becomes the cancellation charge (default: what was paid, so the advance is kept). */
  async cancel(orgId: number, id: number, input: z.infer<typeof cancelSchema>) {
    const b = await this.own(orgId, id);
    if (b.status === "DONE" || b.status === "CANCELLED") throw new ValidationError("This booking is already closed");
    const paid = n(b.invoice?.paidAmount);
    const charge = input.charge ?? paid;
    if (charge < paid) throw new ValidationError(`৳${paid} was paid; refund by deleting or editing that payment first, then cancel`);
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelCharge: charge } });
      if (b.status === "ON_TRIP") await tx.vehicle.updateMany({ where: { id: b.vehicleId, status: "ON_TRIP" }, data: { status: "AVAILABLE" } });
      if (b.invoiceId && charge === 0 && paid === 0) {
        await tx.booking.update({ where: { id: b.id }, data: { invoiceId: null } });
        await tx.notification.updateMany({ where: { invoiceId: b.invoiceId }, data: { invoiceId: null } });
        await tx.invoice.delete({ where: { id: b.invoiceId } });
      } else await rebuildBookingInvoice(tx, b.id);
      await audit(tx, "booking.cancel", "Booking", b.id, { vehicle: b.vehicle.regNo, charge });
    });
    return this.get(orgId, id);
  }

  private async notify(b: Row, template: "BOOKING_CONFIRMED" | "TRIP_BILL") {
    if (!b.invoice) return;
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: b.orgId }, select: { name: true } });
    const token = b.invoice.shareToken ?? crypto.randomBytes(24).toString("base64url");
    if (!b.invoice.shareToken) await prisma.invoice.update({ where: { id: b.invoice.id }, data: { shareToken: token } });
    await prisma.$transaction((tx) =>
      enqueue(tx, {
        orgId: b.orgId,
        template,
        to: b.tenant.phone,
        lang: b.tenant.lang,
        invoiceId: b.invoice!.id,
        dedupeKey: `${template}:${b.id}`,
        data: {
          org: org.name,
          unit: b.vehicle.regNo,
          amount: n(b.invoice!.totalAmount),
          balance: template === "TRIP_BILL" || n(b.invoice!.paidAmount) ? n(b.invoice!.dueAmount) : undefined,
          tripFrom: ymd(bdDate(b.startAt)),
          tripTo: ymd(bdDate(b.endAt)),
          link: `${env.appUrl}/i/${token}`,
        },
      }),
    );
  }
}
