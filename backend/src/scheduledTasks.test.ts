import { test } from "node:test";
import assert from "node:assert/strict";
import { billingMonthFor } from "./scheduledTasks";

test("cron on the 1st bills the current month, so the due date (10th) is still ahead", () => {
  assert.deepEqual(billingMonthFor(new Date(2026, 11, 1)), { month: 12, year: 2026 });
  assert.deepEqual(billingMonthFor(new Date(2027, 0, 1)), { month: 1, year: 2027 });
});
