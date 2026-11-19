export type InvoiceStatus = "PENDING" | "PAID" | "PARTIALLY_PAID" | "OVERDUE";

export interface InvoiceItem {
  id?: number;
  billTypeId: number | null;
  label: string;
  detail: string | null;
  quantity?: number | null;
  rate?: number | null;
  amount: number;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  flatId: number;
  flatName: string;
  buildingName?: string;
  tenantId: number | null;
  tenantName: string | null;
  tenantPhone?: string | null;
  month: number;
  year: number;
  rent: number;
  previousDue: number;
  discount: number;
  fine: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  notes: string | null;
  carriedForward: boolean;
  shareToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: number;
  amount: number;
  method: string;
  transactionId: string | null;
  collector: string | null;
  date: string;
}

export interface InvoiceDetail extends Omit<Invoice, "flatName" | "tenantName"> {
  items: InvoiceItem[];
  payments: InvoicePayment[];
  flat: { name: string; flatNumber: string | null; floorName: string };
  building: { name: string; address: string | null; area: string | null; district: string | null; holdingNumber: string | null };
  owner: { name: string; phone: string | null; email: string | null };
  tenant: { name: string; phone: string | null; email: string | null } | null;
}

export interface UpdateInvoiceInput {
  items?: { billTypeId?: number | null; label: string; detail?: string | null; amount: number }[];
  discount?: number;
  fine?: number;
  notes?: string | null;
  dueDate?: string | null;
}

export interface InvoiceListResponse {
  data: Invoice[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  month?: number;
  year?: number;
  status?: InvoiceStatus;
  search?: string;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  PENDING: "#8A5200",
  PAID: "#0B5D46",
  PARTIALLY_PAID: "#1D4ED8",
  OVERDUE: "#B42318",
};
