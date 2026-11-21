// SMS texts in Bangla and English. Pure functions: easy to test and to preview in the Messages screen.

export type Lang = "BN" | "EN";
export type TemplateKey = "RECEIPT" | "RENT_DUE" | "DUE_TODAY" | "OVERDUE" | "CLAIM_REJECTED" | "NOTICE_ACCEPTED" | "NOTICE_DECLINED";
export const TEMPLATE_KEYS: TemplateKey[] = ["RECEIPT", "RENT_DUE", "DUE_TODAY", "OVERDUE", "CLAIM_REJECTED", "NOTICE_ACCEPTED", "NOTICE_DECLINED"];

export interface TemplateData {
  org: string; // landlord / organisation name
  unit: string; // e.g. "1-A, Green Nest"
  amount: number; // paid (RECEIPT) or due (reminders)
  month?: string; // "2026-12"
  dueDate?: string; // "2026-12-10"
  receiptNo?: string;
  balance?: number; // still due after a payment
  link?: string;
  /** owner's reason (CLAIM_REJECTED, NOTICE_DECLINED) */
  reason?: string;
  /** reference the tenant gave (CLAIM_REJECTED) */
  reference?: string;
  /** "2027-01-31" (NOTICE_ACCEPTED) */
  moveOutDate?: string;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string | number) => String(s).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const grouped = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n); // 1,23,456.5
export const taka = (n: number, lang: Lang) => (lang === "BN" ? `৳${toBnDigits(grouped(n))}` : `Tk ${grouped(n)}`);

const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12" -> "ডিসেম্বর ২০২৬" / "Dec 2026" */
export const monthName = (ym: string, lang: Lang) => {
  const [y, m] = ym.split("-").map(Number);
  return lang === "BN" ? `${BN_MONTHS[m - 1]} ${toBnDigits(y)}` : `${EN_MONTHS[m - 1]} ${y}`;
};
/** "2026-12-10" -> "১০ ডিসেম্বর" / "10 Dec" */
export const dayName = (ymd: string, lang: Lang) => {
  const [, m, d] = ymd.split("-").map(Number);
  return lang === "BN" ? `${toBnDigits(d)} ${BN_MONTHS[m - 1]}` : `${d} ${EN_MONTHS[m - 1]}`;
};

const link = (d: TemplateData) => (d.link ? ` ${d.link}` : "");

export function render(key: TemplateKey, lang: Lang, d: TemplateData): string {
  const bn = lang === "BN";
  switch (key) {
    case "RECEIPT":
      return bn
        ? `${d.org}: ${d.unit}-এর ${taka(d.amount, lang)} পেয়েছি। রসিদ ${d.receiptNo ?? ""}${d.balance ? `। বাকি ${taka(d.balance, lang)}` : ""}।${link(d)}`
        : `${d.org}: received ${taka(d.amount, lang)} for ${d.unit}. Receipt ${d.receiptNo ?? ""}${d.balance ? `. Due ${taka(d.balance, lang)}` : ""}.${link(d)}`;
    case "RENT_DUE":
      return bn
        ? `${d.org}: ${d.unit}-এর ${monthName(d.month!, lang)} মাসের ভাড়া ও বিল ${taka(d.amount, lang)}, ${dayName(d.dueDate!, lang)}-এর মধ্যে দিন।${link(d)}`
        : `${d.org}: ${d.unit} rent and bills for ${monthName(d.month!, lang)}: ${taka(d.amount, lang)}, due by ${dayName(d.dueDate!, lang)}.${link(d)}`;
    case "DUE_TODAY":
      return bn
        ? `${d.org}: আজ ভাড়া দেওয়ার শেষ দিন। ${d.unit}: ${taka(d.amount, lang)}।${link(d)}`
        : `${d.org}: rent is due today. ${d.unit}: ${taka(d.amount, lang)}.${link(d)}`;
    case "OVERDUE":
      return bn
        ? `${d.org}: ${d.unit}-এর ${taka(d.amount, lang)} বকেয়া আছে (শেষ তারিখ ${dayName(d.dueDate!, lang)})। দয়া করে দ্রুত পরিশোধ করুন।${link(d)}`
        : `${d.org}: ${taka(d.amount, lang)} for ${d.unit} is overdue (was due ${dayName(d.dueDate!, lang)}). Please pay soon.${link(d)}`;
    case "CLAIM_REJECTED":
      return bn
        ? `${d.org}: ${d.unit}-এর ${taka(d.amount, lang)} পরিশোধ (${d.reference ?? ""}) মেলানো যায়নি${d.reason ? `: ${d.reason}` : ""}। যোগাযোগ করুন।${link(d)}`
        : `${d.org}: we could not match your payment of ${taka(d.amount, lang)} for ${d.unit} (${d.reference ?? ""})${d.reason ? `: ${d.reason}` : ""}. Please contact us.${link(d)}`;
    case "NOTICE_ACCEPTED":
      return bn
        ? `${d.org}: ${d.unit} ছাড়ার নোটিশ গ্রহণ করা হয়েছে। শেষ দিন ${dayName(d.moveOutDate!, lang)}।${link(d)}`
        : `${d.org}: your notice for ${d.unit} is accepted. Last day ${dayName(d.moveOutDate!, lang)}.${link(d)}`;
    case "NOTICE_DECLINED":
      return bn
        ? `${d.org}: ${d.unit} ছাড়ার নোটিশ নিয়ে কথা বলতে চাই${d.reason ? `: ${d.reason}` : ""}। যোগাযোগ করুন।`
        : `${d.org}: about your notice for ${d.unit}${d.reason ? `: ${d.reason}` : ""}. Please contact us.`;
  }
}

/** Login code for the tenant portal: one short SMS, no landlord name (a phone may rent from several). */
export const otpText = (code: string, lang: Lang) =>
  lang === "BN" ? `RentHub কোড ${toBnDigits(code)}। ৫ মিনিট বৈধ। কাউকে বলবেন না।` : `RentHub code ${code}. Valid 5 min. Do not share it.`;

/** SMS segments: GSM-7 text 160/153 chars, anything with Bangla (UCS-2) 70/67 chars. */
export function smsSegments(text: string) {
  const unicode = /[^\x00-\x7F]/.test(text);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

export const SAMPLE: TemplateData = {
  org: "Hasan Properties",
  unit: "1-A, Rahman Villa",
  amount: 26450,
  month: "2026-12",
  dueDate: "2026-12-10",
  receiptNo: "RCP-2026-000123",
  balance: 1450,
  reason: "Transaction ID not found",
  reference: "bKash 9AB7C2XK1",
  moveOutDate: "2027-01-31",
};
