/** DEPOSIT = paid from the tenant's deposit at move-out (never chosen by hand). TDS = tax a company tenant withheld. */
export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "ROCKET" | "BANK" | "CHEQUE" | "DEPOSIT" | "TDS";

export interface Payment {
  id: number;
  invoiceId: number;
  ownerId: number;
  amount: number;
  method: PaymentMethod;
  transactionId: string | null;
  collector: string | null;
  remarks: string | null;
  date: string;
  receiptNo?: string | null;
  shareToken?: string | null;
  collectedById?: number | null;
  /** staff member who took the money, else the old free-text collector */
  collectorName?: string | null;
  createdAt: string;
  updatedAt: string;
  flatName: string;
  flatNumber: string;
  invoicePeriod: string;
  tenantName: string | null;
}

export interface PaymentDetail extends Payment {
  invoice: {
    month: number;
    year: number;
    totalAmount: number;
    dueAmount: number;
    paidAmount: number;
    status: string;
    dueDate: string;
    flat: { name: string; flatNumber: string; rent: number };
    tenant: { firstName: string; lastName: string; phone: string } | null;
  };
}

export interface PaymentListResponse {
  data: Payment[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentQueryParams {
  page?: number;
  limit?: number;
  invoiceId?: number;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  BANK: "Bank Transfer",
  CHEQUE: "Cheque",
  DEPOSIT: "From deposit",
  TDS: "TDS withheld",
};

export const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH: "#4caf50",
  BKASH: "#e91e63",
  NAGAD: "#ff9800",
  ROCKET: "#2196f3",
  BANK: "#9c27b0",
  CHEQUE: "#607d8b",
  DEPOSIT: "#55615B",
  TDS: "#8A5200",
};
