export type ExpenseCategory = "LIFT" | "SECURITY" | "CLEANING" | "COMMON_ELECTRICITY" | "REPAIRS" | "MAINTENANCE" | "MISC" | "HOLDING_TAX" | "STAFF_SALARY";

export interface Expense {
  id: number;
  ownerId: number;
  buildingId: number | null;
  buildingName: string | null;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  data: Expense[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    summary: ExpenseSummary;
  };
}

export interface ExpenseQueryParams {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  buildingId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  LIFT: "Lift",
  SECURITY: "Security",
  CLEANING: "Cleaning",
  COMMON_ELECTRICITY: "Common Electricity",
  REPAIRS: "Repairs",
  MAINTENANCE: "Maintenance",
  MISC: "Miscellaneous",
  HOLDING_TAX: "Holding tax",
  STAFF_SALARY: "Staff salary",
};

export const EXPENSE_CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

/** Soft tint (chip background) and strong colour (dot, bar), in the "Sabuj Ledger" family. */
export const CATEGORY_TONES: Record<ExpenseCategory, { bg: string; fg: string }> = {
  LIFT: { bg: "#EAEFF2", fg: "#4B6472" },
  SECURITY: { bg: "#E6EEFF", fg: "#1D4ED8" },
  CLEANING: { bg: "#E3F0EA", fg: "#2F7D64" },
  COMMON_ELECTRICITY: { bg: "#FBEFD9", fg: "#B26A00" },
  REPAIRS: { bg: "#FDECEA", fg: "#B42318" },
  MAINTENANCE: { bg: "#F1E8F7", fg: "#7A3E9D" },
  MISC: { bg: "#EEF1EF", fg: "#55615B" },
  HOLDING_TAX: { bg: "#DDEBE5", fg: "#0B5D46" },
  STAFF_SALARY: { bg: "#E8E6F8", fg: "#4338CA" },
};

export interface ExpenseSummary {
  total: number;
  count: number;
  general: number;
  byCategory: { category: ExpenseCategory; amount: number }[];
  previousTotal: number | null;
}
