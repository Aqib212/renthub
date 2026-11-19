const bdt = new Intl.NumberFormat("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** ৳ amount, e.g. ৳1,23,456.50 (Bangladeshi digit grouping). */
export const formatBDT = (value: number | string | null | undefined) =>
  `৳${bdt.format(Number(value ?? 0))}`;

export const apiError = (err: any, fallback = "Something went wrong") =>
  err?.response?.data?.message || fallback;
