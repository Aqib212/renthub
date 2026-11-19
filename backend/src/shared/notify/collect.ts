// Pure rules for receipts and reminders.
import type { TemplateKey } from "./templates";

/** Receipt number: RCP-<year>-<6 digit sequence>, sequence per organisation per year. */
export const formatReceiptNo = (year: number, seq: number) => `RCP-${year}-${String(seq).padStart(6, "0")}`;

/** Which reminder (if any) goes out today: the 5th, the due day, and 3 days after it. */
export function reminderFor(today: Date, dueDay: number): Exclude<TemplateKey, "RECEIPT"> | null {
  const d = today.getDate();
  if (d === dueDay) return "DUE_TODAY";
  if (d === dueDay + 3) return "OVERDUE";
  if (d === 5 && dueDay > 5) return "RENT_DUE";
  return null;
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
  return [h ? ONES[h] + " hundred" : "", rest].filter(Boolean).join(" ");
}

/**
 * Amount in words with the South Asian system used on receipts: 1,23,456.50 ->
 * "One lakh twenty-three thousand four hundred fifty-six taka and fifty paisa only".
 * ponytail: English words only; add Bangla words if owners ask.
 */
export function amountInWords(amount: number): string {
  const taka = Math.floor(amount);
  const paisa = Math.round((amount - taka) * 100);
  const parts: string[] = [];
  let n = taka;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${amountInWordsInt(crore)} crore`);
  if (lakh) parts.push(`${below1000(lakh)} lakh`);
  if (thousand) parts.push(`${below1000(thousand)} thousand`);
  if (n) parts.push(below1000(n));
  const words = (parts.join(" ") || "zero") + " taka" + (paisa ? ` and ${below1000(paisa)} paisa` : "") + " only";
  return words.charAt(0).toUpperCase() + words.slice(1);
}
const amountInWordsInt = (n: number): string => amountInWords(n).replace(/ taka.*$/, "").toLowerCase();
