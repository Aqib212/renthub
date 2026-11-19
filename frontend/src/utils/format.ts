const bdt = new Intl.NumberFormat("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
/** 2026 -> ২০২৬ */
export const toBnDigits = (s: string | number) => String(s).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/** ৳ amount, e.g. ৳1,23,456.50 (Bangladeshi digit grouping); Bangla digits when lang is "bn". */
export const formatBDT = (value: number | string | null | undefined, lang: "en" | "bn" = "en") => {
  const s = `৳${bdt.format(Number(value ?? 0))}`;
  return lang === "bn" ? toBnDigits(s) : s;
};

/** Date as "10 Dec 2026" / "১০ ডিসেম্বর ২০২৬". */
export const formatDate = (value: string | Date | null | undefined, lang: "en" | "bn" = "en") =>
  value ? new Date(value).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–";

export const apiError = (err: any, fallback = "Something went wrong") =>
  err?.response?.data?.message || fallback;
