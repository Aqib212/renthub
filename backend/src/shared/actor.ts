import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who is acting in this request; set by requireOrg (staff) or asTenant (portal) so services need no req.
 * `buildingIds` (staff only): the member may only see these buildings; null/absent = all.
 */
export interface Actor { orgId: number; userId?: number; membershipId?: number; tenantId?: number; buildingIds?: number[] | null; ip?: string; userAgent?: string }
export const actorStore = new AsyncLocalStorage<Actor>();
