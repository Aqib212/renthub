import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBdPhone } from "./phone";
import { render, smsSegments, toBnDigits, taka, monthName, otpText, TEMPLATE_KEYS, SAMPLE } from "./templates";
import { amountInWords, formatReceiptNo, reminderFor } from "./collect";

test("Bangladeshi phone numbers", () => {
  assert.equal(normalizeBdPhone("01711-234567"), "8801711234567");
  assert.equal(normalizeBdPhone("+880 1911 234567"), "8801911234567");
  assert.equal(normalizeBdPhone("8801311234567"), "8801311234567");
  assert.equal(normalizeBdPhone("01211234567"), null); // no 012 operator
  assert.equal(normalizeBdPhone("0171123456"), null); // too short
  assert.equal(normalizeBdPhone("02-9876543"), null); // landline
  assert.equal(normalizeBdPhone(""), null);
});

test("Bangla digits and taka", () => {
  assert.equal(toBnDigits("2026-12"), "২০২৬-১২");
  assert.equal(taka(123456.5, "BN"), "৳১,২৩,৪৫৬.৫");
  assert.equal(taka(15000, "EN"), "Tk 15,000");
  assert.equal(monthName("2026-12", "BN"), "ডিসেম্বর ২০২৬");
});

test("every template renders in both languages (EN ≤ 2 SMS segments, BN ≤ 3)", () => {
  for (const key of TEMPLATE_KEYS) {
    for (const lang of ["BN", "EN"] as const) {
      const text = render(key, lang, { ...SAMPLE, link: "https://renthub.app/r/AbCdEfGhIjKlMnOpQrStUvWxYz012345" });
      assert.ok(text.includes(SAMPLE.org), `${key}/${lang} names the landlord`);
      assert.ok(!/undefined|NaN/.test(text), `${key}/${lang}: ${text}`);
      // Bangla SMS are UCS-2 (67 chars a part); keep them to at most 3 parts even with a long link
      assert.ok(smsSegments(text) <= (lang === "BN" ? 3 : 2), `${key}/${lang} is ${smsSegments(text)} segments: ${text}`);
    }
  }
  assert.match(render("RECEIPT", "BN", SAMPLE), /৳২৬,৪৫০/);
  assert.match(render("RECEIPT", "EN", SAMPLE), /Due Tk 1,450/);
});

test("portal login code fits one SMS in both languages", () => {
  assert.equal(smsSegments(otpText("123456", "EN")), 1);
  assert.equal(smsSegments(otpText("123456", "BN")), 1);
  assert.match(otpText("123456", "BN"), /১২৩৪৫৬/);
});

test("reminder schedule", () => {
  const on = (d: number) => new Date(2026, 11, d);
  assert.equal(reminderFor(on(5), 10), "RENT_DUE");
  assert.equal(reminderFor(on(10), 10), "DUE_TODAY");
  assert.equal(reminderFor(on(13), 10), "OVERDUE");
  assert.equal(reminderFor(on(6), 10), null);
  assert.equal(reminderFor(on(5), 5), "DUE_TODAY"); // due on the 5th: no separate early reminder
  assert.equal(reminderFor(on(3), 3), "DUE_TODAY");
});

test("receipt numbers and amount in words", () => {
  assert.equal(formatReceiptNo(2026, 123), "RCP-2026-000123");
  assert.equal(amountInWords(15000), "Fifteen thousand taka only");
  assert.equal(amountInWords(123456.5), "One lakh twenty-three thousand four hundred fifty-six taka and fifty paisa only");
  assert.equal(amountInWords(25000000), "Two crore fifty lakh taka only");
  assert.equal(amountInWords(905), "Nine hundred five taka only");
});

import { currentDocs, daysLeft, expiryStage } from "./expiry";

test("document expiry: reminder stages and renewals", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  const today = d("2026-12-01");
  assert.equal(daysLeft(d("2026-12-31"), today), 30);
  assert.equal(expiryStage(d("2026-12-31"), today), 30);
  assert.equal(expiryStage(d("2026-12-08"), today), 7);
  assert.equal(expiryStage(d("2026-12-01"), today), 0);
  assert.equal(expiryStage(d("2026-12-02"), today), null);
  assert.equal(expiryStage(d("2026-11-30"), today), null); // already expired: listed, not texted again
  // a renewal supersedes the old document of the same kind on the same vehicle
  const docs = [
    { id: 1, kind: "INSURANCE", assetId: 5, expiresAt: d("2026-12-05") },
    { id: 2, kind: "INSURANCE", assetId: 5, expiresAt: d("2027-12-05") },
    { id: 3, kind: "FITNESS", assetId: 5, expiresAt: d("2026-12-08") },
    { id: 4, kind: "INSURANCE", assetId: 6, expiresAt: d("2026-12-05") },
    { id: 5, kind: "OTHER", assetId: 5, expiresAt: null },
  ];
  assert.deepEqual(currentDocs(docs).map((x) => x.id).sort(), [2, 3, 4]);
});

test("document expiry SMS says today or the days left", () => {
  assert.match(render("DOC_EXPIRY", "EN", { ...SAMPLE, daysLeft: 0 }), /expires today/);
  assert.match(render("DOC_EXPIRY", "BN", { ...SAMPLE, daysLeft: 0 }), /আজ শেষ/);
  assert.match(render("DOC_EXPIRY", "EN", SAMPLE), /7 days left/);
});

test("booking and trip bill SMS", () => {
  assert.match(render("BOOKING_CONFIRMED", "EN", { ...SAMPLE, unit: "Dhaka Metro-Ga 12-3456", amount: 13500, balance: 8500 }), /booking confirmed, Dhaka Metro-Ga 12-3456 on 5 Dec to 7 Dec\. Estimate Tk 13,500, Tk 8,500 after the advance/);
  assert.match(render("BOOKING_CONFIRMED", "BN", { ...SAMPLE, tripTo: SAMPLE.tripFrom, balance: undefined }), /৫ ডিসেম্বর .*বুকিং নিশ্চিত/);
  assert.match(render("TRIP_BILL", "EN", { ...SAMPLE, balance: 0 }), /paid in full/);
  assert.match(render("TRIP_BILL", "BN", SAMPLE), /বাকি ৳১,৪৫০/);
});
