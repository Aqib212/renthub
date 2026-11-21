import type { OrgRole } from "@prisma/client";

/** What each workspace role may do. Reading is open to every member unless listed here. */
export const ACTIONS = [
  "property:write", // buildings, floors, flats, tenants
  "billing:write", // bill types, monthly readings, invoice generation and edits
  "payment:write",
  "expense:write",
  "report:read",
  "staff:manage",
  "settings:write",
  "cash:handover", // receive cash from a collector
  "maintenance:write",
  "document:write", // upload and delete files in the vault
  "audit:read",
] as const;
export type Action = (typeof ACTIONS)[number];

const ALLOWED: Record<OrgRole, readonly Action[]> = {
  OWNER: ACTIONS,
  MANAGER: ["property:write", "billing:write", "payment:write", "expense:write", "report:read", "cash:handover", "maintenance:write", "document:write"],
  ACCOUNTANT: ["payment:write", "expense:write", "report:read"],
  CARETAKER: ["payment:write", "maintenance:write"],
};

export const can = (role: OrgRole, action: Action) => ALLOWED[role].includes(action);

/** For the Staff screen's permission matrix. */
export const permissionMatrix = () =>
  (Object.keys(ALLOWED) as OrgRole[]).map((role) => ({ role, actions: Object.fromEntries(ACTIONS.map((a) => [a, can(role, a)])) }));
