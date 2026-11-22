import { actorStore } from "./actor";

/**
 * Building scope for staff limited to some buildings (Membership.buildingIds).
 * The Prisma hook in shared/prisma.ts adds `SCOPE[model]` to every read and bulk write while such a member is
 * acting, so services keep filtering by orgId only. Rows with no building (vehicles, jama, bookings, general
 * expenses) are hidden from them. Raw SQL is not covered: use `rawInvoiceScope()` there.
 */
export const allowedBuildings = (): bigint[] | null => {
  const ids = actorStore.getStore()?.buildingIds;
  return Array.isArray(ids) ? ids.map((n) => BigInt(n)) : null;
};

type W = Record<string, unknown>;
const building = (ids: bigint[]): W => ({ buildingId: { in: ids } });
const flat = (ids: bigint[]): W => ({ floor: building(ids) });
const asset = (ids: bigint[]): W => ({ unit: flat(ids) });
const agreement = (ids: bigint[]): W => ({ asset: asset(ids) });
const invoice = (ids: bigint[]): W => ({ flat: flat(ids) });
const nothing = (): W => ({ id: { in: [] } });

export const SCOPE: Record<string, (ids: bigint[]) => W> = {
  Building: (ids) => ({ id: { in: ids } }),
  Floor: building,
  Flat: flat,
  Asset: asset,
  Agreement: agreement,
  // ponytail: a tenant with no agreement yet is hidden from a limited member; add Tenant.buildingId if that bites
  Tenant: (ids) => ({ agreements: { some: agreement(ids) } }),
  Invoice: invoice,
  InvoiceItem: (ids) => ({ invoice: invoice(ids) }),
  Payment: (ids) => ({ invoice: invoice(ids) }),
  PaymentClaim: (ids) => ({ invoice: invoice(ids) }),
  OnlinePayment: (ids) => ({ invoice: invoice(ids) }),
  Notification: (ids) => ({ invoice: invoice(ids) }),
  Expense: building,
  BillEntry: (ids) => ({ flat: flat(ids) }),
  FlatCharge: (ids) => ({ flat: flat(ids) }),
  BuildingBill: building,
  MaintenanceRequest: (ids) => ({ asset: asset(ids) }),
  RateRevision: (ids) => ({ agreement: agreement(ids) }),
  DepositEntry: (ids) => ({ agreement: agreement(ids) }),
  NoticeRequest: (ids) => ({ agreement: agreement(ids) }),
  Document: (ids) => ({ OR: [{ asset: asset(ids) }, { tenant: { agreements: { some: agreement(ids) } } }, { agreement: agreement(ids) }, { maintenance: { asset: asset(ids) } }] }),
  Vehicle: nothing,
  DayEntry: nothing,
  Booking: nothing,
};

/** Reads and bulk writes get the scope; single-row writes follow a scoped read in every service. */
export const SCOPED_ACTIONS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]);

/** Adds the scope to a where clause; keeps unique fields at the top so findUnique still accepts it. */
export function scopeWhere(model: string | undefined, where: W | undefined) {
  const ids = allowedBuildings();
  const f = model && SCOPE[model];
  if (!ids || !f) return where;
  const w = where ?? {};
  const and = Array.isArray(w.AND) ? w.AND : w.AND ? [w.AND] : [];
  return { ...w, AND: [...and, f(ids)] };
}

/** For raw SQL over invoices (alias `i`): "" or " AND i.flatId IN (…)". The ids come from the DB, never from input. */
export const rawInvoiceScope = (alias = "i") => {
  const ids = allowedBuildings();
  if (!ids) return "";
  const list = ids.length ? ids.map((n) => String(Number(n))).join(",") : "NULL";
  return ` AND ${alias}.flatId IN (SELECT sf.id FROM flats sf JOIN floors sfl ON sfl.id = sf.floorId WHERE sfl.buildingId IN (${list}))`;
};
