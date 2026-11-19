import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBdPhone } from "./phone";
import { render, smsSegments, toBnDigits, taka, monthName, TEMPLATE_KEYS, SAMPLE } from "./templates";
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
