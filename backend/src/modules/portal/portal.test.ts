import { test } from "node:test";
import assert from "node:assert/strict";
import { otpThrottle } from "./portal.auth";

test("portal OTP throttle: one a minute, five an hour", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  const ago = (s: number) => new Date(now.getTime() - s * 1000);
  assert.equal(otpThrottle([], now), 0);
  assert.equal(otpThrottle([ago(20)], now), 40); // wait for the minute
  assert.equal(otpThrottle([ago(61)], now), 0);
  const five = [ago(3000), ago(2400), ago(1800), ago(1200), ago(600)];
  assert.equal(otpThrottle(five, now), 600); // oldest drops out of the hour in 10 minutes
  assert.equal(otpThrottle([ago(4000), ...five.slice(1)], now), 0); // only 4 within the hour
});
