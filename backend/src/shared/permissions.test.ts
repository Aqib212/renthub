import { test } from "node:test";
import assert from "node:assert/strict";
import { can } from "./permissions";

test("role permissions", () => {
  assert.ok(can("OWNER", "staff:manage"));
  assert.ok(!can("MANAGER", "staff:manage"));
  assert.ok(can("MANAGER", "billing:write"));
  assert.ok(can("ACCOUNTANT", "report:read"));
  assert.ok(!can("ACCOUNTANT", "billing:write"));
  assert.ok(can("CARETAKER", "payment:write"));
  assert.ok(!can("CARETAKER", "expense:write"));
  assert.ok(!can("CARETAKER", "report:read"));
});
