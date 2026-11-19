import { Prisma, BillType, BillEntry, FlatCharge } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { NotFoundError, ConflictError, ValidationError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { calcCharge, BERC_RESIDENTIAL, type BillTypeCalc, type ChargeResult } from "../../shared/utils/billing";
import type { BillTypeInput, FlatChargesInput, SaveEntriesInput } from "./bill-type.validation";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const period = (month: number, year: number) => year * 12 + month;

const STARTER_TYPES: Prisma.BillTypeCreateManyInput[] = [
  { ownerId: 0, name: "Electricity", calcMethod: "SLAB", unitLabel: "kWh", sortOrder: 1, slabs: BERC_RESIDENTIAL.slabs as any, demandChargePerKw: BERC_RESIDENTIAL.demandChargePerKw, vatPercent: BERC_RESIDENTIAL.vatPercent },
  { ownerId: 0, name: "Water", calcMethod: "FIXED", rate: 500, sortOrder: 2 },
  { ownerId: 0, name: "Gas", calcMethod: "FIXED", rate: 1080, sortOrder: 3 },
  { ownerId: 0, name: "Service Charge", calcMethod: "FIXED", rate: 1000, sortOrder: 4 },
  { ownerId: 0, name: "Garage", calcMethod: "FIXED", rate: 1500, appliesToAll: false, sortOrder: 5 },
];

export function toCalc(bt: BillType): BillTypeCalc {
  return {
    name: bt.name,
    calcMethod: bt.calcMethod,
    rate: num(bt.rate),
    unitLabel: bt.unitLabel,
    slabs: bt.slabs as any,
    fixedCharge: num(bt.fixedCharge),
    demandChargePerKw: num(bt.demandChargePerKw),
    vatPercent: num(bt.vatPercent),
  };
}

/** Flats that get a bill this month: marked occupied or with an active tenant. */
export const billableFlatWhere = (ownerId: number): Prisma.FlatWhereInput => ({
  floor: { building: { ownerId } },
  OR: [{ status: "OCCUPIED" }, { tenants: { some: { status: "ACTIVE" } } }],
});

export interface FlatChargeLine {
  billType: BillType;
  applies: boolean;
  override: number | null;
  entry: BillEntry | null;
  lastReading: number | null; // currentReading of the most recent earlier month
  result: ChargeResult | null;
}

/**
 * Everything needed to bill a set of flats for one month, shared by the
 * Monthly Billing screen and invoice generation so both compute the same numbers.
 */
export async function loadBillingContext(ownerId: number, month: number, year: number, flatWhere: Prisma.FlatWhereInput) {
  const [billTypes, flats] = await Promise.all([
    prisma.billType.findMany({ where: { ownerId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.flat.findMany({
      where: flatWhere,
      orderBy: [{ floor: { building: { name: "asc" } } }, { name: "asc" }],
      include: {
        tenants: { where: { status: "ACTIVE" }, take: 1, orderBy: { moveInDate: "desc" } },
        floor: { select: { name: true, building: { select: { id: true, name: true } } } },
        charges: true,
      },
    }),
  ]);

  const flatIds = flats.map((f) => f.id);
  const entries = flatIds.length
    ? await prisma.billEntry.findMany({
        where: { flatId: { in: flatIds }, year: { lte: year } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      })
    : [];

  const target = period(month, year);
  const key = (flatId: bigint, billTypeId: bigint) => `${flatId}:${billTypeId}`;
  const current = new Map<string, BillEntry>();
  const last = new Map<string, number>();
  for (const e of entries) {
    const p = period(e.month, e.year);
    const k = key(e.flatId, e.billTypeId);
    if (p === target) current.set(k, e);
    else if (p < target && !last.has(k) && e.currentReading !== null) last.set(k, Number(e.currentReading));
  }

  const rows = flats.map((flat) => {
    const tenant = flat.tenants[0] ?? null;
    const chargeMap = new Map<bigint, FlatCharge>(flat.charges.map((c) => [c.billTypeId, c]));
    const lines: FlatChargeLine[] = billTypes.map((bt) => {
      const fc = chargeMap.get(bt.id);
      const applies = fc ? fc.isActive : bt.appliesToAll;
      const entry = current.get(key(flat.id, bt.id)) ?? null;
      const lastReading = last.get(key(flat.id, bt.id)) ?? null;
      const override = num(fc?.amount);
      const result = applies
        ? calcCharge(toCalc(bt), {
            override,
            members: tenant?.members ?? 1,
            loadKw: num(flat.sanctionedLoad),
            entry: entry && {
              previousReading: num(entry.previousReading) ?? (entry.currentReading !== null ? lastReading : null),
              currentReading: num(entry.currentReading),
              units: num(entry.units),
              amount: num(entry.amount),
            },
          })
        : null;
      return { billType: bt, applies, override, entry, lastReading, result };
    });
    return { flat, tenant, lines };
  });

  return { billTypes, rows };
}

export class BillTypeService {
  async list(ownerId: string) {
    const oid = toNumberId(ownerId);
    if ((await prisma.billType.count({ where: { ownerId: oid } })) === 0) {
      await prisma.billType.createMany({ data: STARTER_TYPES.map((t) => ({ ...t, ownerId: oid })) });
    }
    return prisma.billType.findMany({
      where: { ownerId: oid },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { flatCharges: { where: { isActive: true } } } } },
    });
  }

  private async get(ownerId: string, id: string) {
    const bt = await prisma.billType.findFirst({ where: { id: toNumberId(id), ownerId: toNumberId(ownerId) } });
    if (!bt) throw new NotFoundError("Bill type not found");
    return bt;
  }

  private data(input: Partial<BillTypeInput>) {
    const { slabs, ...rest } = input;
    return { ...rest, ...(slabs !== undefined && { slabs: slabs === null ? Prisma.DbNull : (slabs as any) }) };
  }

  private async unique<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictError("A bill type with this name already exists");
      }
      throw e;
    }
  }

  async create(ownerId: string, input: BillTypeInput) {
    return this.unique(() =>
      prisma.billType.create({ data: { ...(this.data(input) as any), ownerId: toNumberId(ownerId) } })
    );
  }

  async update(ownerId: string, id: string, input: Partial<BillTypeInput>) {
    await this.get(ownerId, id);
    return this.unique(() => prisma.billType.update({ where: { id: toNumberId(id) }, data: this.data(input) as any }));
  }

  async remove(ownerId: string, id: string) {
    await this.get(ownerId, id);
    // invoice items keep their copied label; billTypeId is set to null
    await prisma.billType.delete({ where: { id: toNumberId(id) } });
  }

  async getFlats(ownerId: string, id: string) {
    const bt = await this.get(ownerId, id);
    const flats = await prisma.flat.findMany({
      where: { floor: { building: { ownerId: toNumberId(ownerId) } } },
      orderBy: [{ floor: { building: { name: "asc" } } }, { name: "asc" }],
      include: {
        floor: { select: { building: { select: { name: true } } } },
        charges: { where: { billTypeId: bt.id } },
        tenants: { where: { status: "ACTIVE" }, take: 1, select: { firstName: true, lastName: true } },
      },
    });
    return flats.map((f) => ({
      flatId: f.id,
      flatName: f.name,
      buildingName: f.floor.building.name,
      tenantName: f.tenants[0] ? `${f.tenants[0].firstName} ${f.tenants[0].lastName}` : null,
      isActive: f.charges[0] ? f.charges[0].isActive : bt.appliesToAll,
      amount: num(f.charges[0]?.amount),
    }));
  }

  async setFlats(ownerId: string, id: string, input: FlatChargesInput) {
    const bt = await this.get(ownerId, id);
    const ids = input.flats.map((f) => f.flatId);
    const owned = await prisma.flat.count({ where: { id: { in: ids }, floor: { building: { ownerId: toNumberId(ownerId) } } } });
    if (owned !== new Set(ids).size) throw new NotFoundError("Flat not found");

    // Only store flats that differ from the bill type's default, so flipping
    // appliesToAll later still affects every flat the owner didn't customise.
    await prisma.$transaction(
      input.flats.map((f) =>
        f.isActive === bt.appliesToAll && f.amount == null
          ? prisma.flatCharge.deleteMany({ where: { flatId: f.flatId, billTypeId: bt.id } })
          : prisma.flatCharge.upsert({
          where: { flatId_billTypeId: { flatId: f.flatId, billTypeId: bt.id } },
          update: { isActive: f.isActive, amount: f.amount ?? null },
          create: { flatId: f.flatId, billTypeId: bt.id, isActive: f.isActive, amount: f.amount ?? null },
        })
      )
    );
    return this.getFlats(ownerId, id);
  }

  async getEntries(ownerId: string, month: number, year: number) {
    const oid = toNumberId(ownerId);
    await this.list(ownerId); // seeds starter types on first use
    const { billTypes, rows } = await loadBillingContext(oid, month, year, billableFlatWhere(oid));
    const invoices = await prisma.invoice.findMany({
      where: { ownerId: oid, month, year },
      select: { id: true, flatId: true, status: true, totalAmount: true },
    });
    const invoiceByFlat = new Map(invoices.map((i) => [i.flatId, i]));

    return {
      billTypes,
      rows: rows.map(({ flat, tenant, lines }) => ({
        flatId: flat.id,
        flatName: flat.name,
        flatNumber: flat.flatNumber,
        buildingName: flat.floor.building.name,
        rent: num(flat.rent),
        sanctionedLoad: num(flat.sanctionedLoad),
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : null,
        members: tenant?.members ?? 1,
        invoice: invoiceByFlat.get(flat.id) ?? null,
        charges: lines.map((l) => ({
          billTypeId: l.billType.id,
          applies: l.applies,
          override: l.override,
          lastReading: l.lastReading,
          entry: l.entry && {
            previousReading: num(l.entry.previousReading),
            currentReading: num(l.entry.currentReading),
            units: num(l.entry.units),
            amount: num(l.entry.amount),
            note: l.entry.note,
          },
          result: l.result,
        })),
      })),
    };
  }

  async saveEntries(ownerId: string, input: SaveEntriesInput) {
    const oid = toNumberId(ownerId);
    const flatIds = [...new Set(input.entries.map((e) => e.flatId))];
    const typeIds = [...new Set(input.entries.map((e) => e.billTypeId))];
    const [flats, types] = await Promise.all([
      prisma.flat.count({ where: { id: { in: flatIds }, floor: { building: { ownerId: oid } } } }),
      prisma.billType.count({ where: { id: { in: typeIds }, ownerId: oid } }),
    ]);
    if (flats !== flatIds.length || types !== typeIds.length) throw new NotFoundError("Flat or bill type not found");

    for (const e of input.entries) {
      if (e.currentReading != null && e.previousReading != null && e.currentReading < e.previousReading) {
        throw new ValidationError("Current reading cannot be lower than the previous reading");
      }
    }

    const { month, year } = input;
    await prisma.$transaction(
      input.entries.map((e) => {
        const where = { flatId_billTypeId_month_year: { flatId: e.flatId, billTypeId: e.billTypeId, month, year } };
        const values = {
          previousReading: e.previousReading ?? null,
          currentReading: e.currentReading ?? null,
          units: e.units ?? null,
          amount: e.amount ?? null,
          note: e.note || null,
        };
        const empty = Object.values(values).every((v) => v === null);
        return empty
          ? prisma.billEntry.deleteMany({ where: { flatId: e.flatId, billTypeId: e.billTypeId, month, year } })
          : prisma.billEntry.upsert({ where, update: values, create: { ...values, flatId: e.flatId, billTypeId: e.billTypeId, month, year } });
      })
    );
    return this.getEntries(ownerId, month, year);
  }
}
