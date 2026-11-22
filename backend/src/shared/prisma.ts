import { PrismaClient, Prisma } from "@prisma/client";
import { normalizeBdPhone } from "./notify/phone";
import { SCOPED_ACTIONS, scopeWhere } from "./scope";

if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

// Decimal money columns serialize as numbers, not strings
(Prisma.Decimal.prototype as any).toJSON = function () {
  return this.toNumber();
};

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// The tenant portal logs in by Tenant.phoneNormalized; derive it whenever a write sets `phone`.
// ponytail: Prisma $use is deprecated in v5 but still works; move to a $extends query hook when upgrading Prisma.
if (!(globalForPrisma as any).phoneHook) {
  (globalForPrisma as any).phoneHook = true;
  prisma.$use(async (params, next) => {
    if (params.model === "Tenant" && ["create", "update", "upsert", "createMany", "updateMany"].includes(params.action)) {
      const fix = (d: any) => {
        if (d && typeof d === "object" && "phone" in d) {
          const raw = typeof d.phone === "object" && d.phone !== null ? d.phone.set : d.phone;
          d.phoneNormalized = normalizeBdPhone(raw);
        }
      };
      const a = params.args ?? {};
      if (params.action === "upsert") { fix(a.create); fix(a.update); }
      else if (Array.isArray(a.data)) a.data.forEach(fix);
      else fix(a.data);
    }
    return next(params);
  });
}

// Staff limited to some buildings (Membership.buildingIds) only ever see rows of those buildings (shared/scope.ts).
if (!(globalForPrisma as any).scopeHook) {
  (globalForPrisma as any).scopeHook = true;
  prisma.$use(async (params, next) => {
    if (SCOPED_ACTIONS.has(params.action)) {
      const where = scopeWhere(params.model, params.args?.where);
      if (where !== params.args?.where) params.args = { ...(params.args ?? {}), where };
    }
    return next(params);
  });
}
