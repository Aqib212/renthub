export type ExpenseCategory = "LIFT" | "SECURITY" | "CLEANING" | "COMMON_ELECTRICITY" | "REPAIRS" | "MAINTENANCE" | "MISC";

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
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  LIFT: "#607d8b",
  SECURITY: "#2196f3",
  CLEANING: "#4caf50",
  COMMON_ELECTRICITY: "#ff9800",
  REPAIRS: "#f44336",
  MAINTENANCE: "#9c27b0",
  MISC: "#795548",
};
