import { test } from "node:test";
import assert from "node:assert/strict";
import { durationMs, readCookie } from "./cookies";

test("cookie reader and token lifetimes", () => {
  const req = { headers: { cookie: "a=1; rh_rt=abc%3D%3D.def; other=x" } };
  assert.equal(readCookie(req, "rh_rt"), "abc==.def");
  assert.equal(readCookie(req, "rh_prt"), undefined);
  assert.equal(readCookie({ headers: {} }, "rh_rt"), undefined);
  assert.equal(durationMs("7d"), 7 * 86_400_000);
  assert.equal(durationMs("15m"), 900_000);
  assert.equal(durationMs("3600"), 3_600_000);
});
