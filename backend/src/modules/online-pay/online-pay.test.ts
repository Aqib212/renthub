import { test } from "node:test";
import assert from "node:assert/strict";
import { decrypt, encrypt } from "./online-pay.service";

test("gateway store password: encrypted at rest, round-trips, tamper is rejected", () => {
  const enc = encrypt("s3cret-store-pass");
  assert.ok(!enc.includes("s3cret"));
  assert.notEqual(encrypt("s3cret-store-pass"), enc); // fresh IV each time
  assert.equal(decrypt(enc), "s3cret-store-pass");
  const [iv, tag, data] = enc.split(".");
  assert.throws(() => decrypt([iv, tag, data.slice(0, -2) + (data.endsWith("A") ? "BB" : "AA")].join(".")));
});
