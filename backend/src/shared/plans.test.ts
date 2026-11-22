import { test } from "node:test";
import assert from "node:assert/strict";
import { canAdd, limitFor } from "./plans";

const today = new Date("2026-12-01T00:00:00Z");
const later = new Date("2027-06-01T00:00:00Z");
const past = new Date("2026-11-01T00:00:00Z");

test("plan limits: tiers, custom, expiry, unknown", () => {
  assert.deepEqual(limitFor({ plan: "FREE", unitLimit: null, paidUntil: null }, today), { limit: 5, expired: false });
  assert.deepEqual(limitFor({ plan: "STARTER", unitLimit: null, paidUntil: later }, today), { limit: 30, expired: false });
  assert.deepEqual(limitFor({ plan: "PRO", unitLimit: null, paidUntil: null }, today), { limit: 150, expired: false });
  assert.deepEqual(limitFor({ plan: "CUSTOM", unitLimit: 400, paidUntil: later }, today), { limit: 400, expired: false });
  assert.deepEqual(limitFor({ plan: "STARTER", unitLimit: null, paidUntil: past }, today), { limit: 5, expired: true });
  assert.deepEqual(limitFor({ plan: "CUSTOM", unitLimit: 400, paidUntil: past }, today), { limit: 5, expired: true });
  assert.deepEqual(limitFor({ plan: "WHATEVER", unitLimit: null, paidUntil: null }, today), { limit: 5, expired: false });
});

test("plan limits: room to add", () => {
  assert.equal(canAdd(29, 30), true);
  assert.equal(canAdd(30, 30), false);
  assert.equal(canAdd(28, 30, 3), false);
});
