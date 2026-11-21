import axios from "axios";
import client from "./client";

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export interface Receipt {
  id: number;
  receiptNo: string | null;
  date: string;
  amount: number;
  amountInWords: string;
  method: string;
  transactionId: string | null;
  remarks: string | null;
  collectorName: string | null;
  lang: "BN" | "EN";
  invoice: { invoiceNo: string; month: number; year: number; totalAmount: number; paidAmount: number; dueAmount: number };
  tenant: { name: string; phone: string | null } | null;
  unit: { name: string; floorName: string };
  building: { name: string; address: string | null; holdingNumber: string | null };
  owner: { name: string; phone: string | null; email: string | null };
  shareToken?: string | null;
}

export type NotificationStatus = "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
export interface OutboxRow {
  id: number;
  to: string | null;
  template: "RECEIPT" | "RENT_DUE" | "DUE_TODAY" | "OVERDUE" | "CLAIM_REJECTED" | "NOTICE_ACCEPTED" | "NOTICE_DECLINED";
  lang: "BN" | "EN";
  body: string | null;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  segments: number;
}

export interface PendingCash {
  total: number;
  collectors: {
    membershipId: number;
    name: string;
    role: string;
    total: number;
    payments: { id: number; receiptNo: string | null; date: string; amount: number; flatName: string; tenantName: string | null; period: string }[];
  }[];
}

export interface Handover {
  id: number;
  amount: number;
  date: string;
  note: string | null;
  from: { user: { firstName: string; lastName: string } };
  to: { user: { firstName: string; lastName: string } };
  _count: { payments: number };
}

export const receiptApi = {
  get: (paymentId: number | string) => d<Receipt>(client.get(`/payments/${paymentId}/receipt`)),
  share: (paymentId: number) => d<{ shareToken: string }>(client.post(`/payments/${paymentId}/share`)),
  /** No auth header: the tenant's public link. */
  getShared: (token: string) => axios.get(`/api/v1/public/receipts/${encodeURIComponent(token)}`).then((r) => r.data.data as Receipt),
};

export const notificationApi = {
  list: (params?: { status?: NotificationStatus; page?: number; limit?: number }) =>
    client.get("/notifications", { params }).then((r) => ({ data: r.data.data as OutboxRow[], meta: r.data.meta as { total: number; page: number; totalPages: number; counts: Record<string, number> } })),
  retry: (id: number) => d(client.post(`/notifications/${id}/retry`)),
  preview: () => d<{ key: OutboxRow["template"]; BN: string; EN: string }[]>(client.get("/notifications/preview")),
  remindInvoice: (invoiceId: number) => d<{ queued: boolean; to: string | null }>(client.post(`/invoices/${invoiceId}/remind`)),
};

export const cashApi = {
  pending: () => d<PendingCash>(client.get("/cash-handovers/pending")),
  history: () => d<Handover[]>(client.get("/cash-handovers")),
  record: (body: { fromMembershipId: number; paymentIds: number[]; note?: string }) => d<Handover>(client.post("/cash-handovers", body)),
};

export const receiptLink = (token: string) => `${window.location.origin}/r/${token}`;
