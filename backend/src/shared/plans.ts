// Plans (pure). A plan limits how many units + vehicles a workspace may have; nothing else is gated.

export const PLANS = { FREE: 5, STARTER: 30, PRO: 150 } as const;
export type PlanName = keyof typeof PLANS | "CUSTOM";
export const PLAN_NAMES: PlanName[] = ["FREE", "STARTER", "PRO", "CUSTOM"];

export interface PlanOrg { plan: string; unitLimit: number | null; paidUntil: Date | null }

/** The unit + vehicle limit in force today: CUSTOM uses unitLimit; a paid plan past paidUntil drops to FREE. */
export function limitFor(org: PlanOrg, today = new Date()) {
  const expired = org.plan !== "FREE" && !!org.paidUntil && org.paidUntil.getTime() < today.getTime();
  if (expired) return { limit: PLANS.FREE, expired };
  if (org.plan === "CUSTOM") return { limit: org.unitLimit ?? PLANS.FREE, expired };
  return { limit: PLANS[org.plan as keyof typeof PLANS] ?? PLANS.FREE, expired };
}

export const canAdd = (used: number, limit: number, n = 1) => used + n <= limit;
