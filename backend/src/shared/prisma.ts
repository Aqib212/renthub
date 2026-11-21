import { PrismaClient, Prisma } from "@prisma/client";
import { normalizeBdPhone } from "./notify/phone";

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
