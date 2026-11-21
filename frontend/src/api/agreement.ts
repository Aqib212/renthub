import client from "./client";

export type AgreementStatus = "DRAFT" | "ACTIVE" | "NOTICE" | "ENDED";
export type DepositType = "RECEIVED" | "ADJUSTED" | "DEDUCTED_DAMAGE" | "REFUNDED";

export interface AgreementSummary {
  id: number;
  status: AgreementStatus;
  cycle: "MONTHLY" | "DAILY" | "WEEKLY" | "TRIP";
  rate: number;
  startDate: string;
  endDate: string | null;
  noticeDate: string | null;
  dueDay: number;
  noticeDays: number;
  bankOnly: boolean;
  tdsPercent: number;
  depositBalance: number;
  tenant: { id: number; firstName: string; lastName: string; phone: string | null; nid?: string | null; members?: number; lang?: "BN" | "EN"; permanentAddress?: string | null };
  unit: { id: number; name: string; floorName: string; building: { id: number; name: string } } | null;
}

export interface AgreementDetail extends AgreementSummary {
  currentRate: number;
  terms: { clauses?: string[] } | null;
  /** pending move-out requests from the tenant portal */
  notices?: { id: number; noticeDate: string; moveOutDate: string; reason: string | null; createdAt: string }[];
  revisions: { id: number; effectiveFrom: string; rate: number; reason: string | null }[];
  deposits: { id: number; type: DepositType; amount: number; date: string; note: string | null }[];
  invoices: { id: number; month: number; year: number; totalAmount: number; paidAmount: number; dueAmount: number; status: string; carriedForward: boolean }[];
}

/** Write calls return the agreement plus rule warnings (Bangladesh rent rules warn, never block). */
export interface WithWarnings { agreement: AgreementDetail; warnings: string[] }

export interface Settlement {
  endDate: string;
  depositBalance: number;
  openDues: number;
  finalRent: number;
  deductions: number;
  lastMonthBilled: boolean;
  refund: number;
  due: number;
  adjusted: number;
}

export interface NewAgreementInput {
  flatId: number;
  tenantId?: number;
  tenant?: { firstName: string; lastName: string; phone?: string; nid?: string; occupation?: string; members?: number };
  rate?: number;
  startDate: string;
  endDate?: string;
  dueDay?: number;
  noticeDays?: number;
  deposit?: number;
  activate?: boolean;
  firstInvoice?: boolean;
}

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const agreementApi = {
  list: (params?: { status?: AgreementStatus | "LIVE"; flatId?: number; tenantId?: number }) => d<AgreementSummary[]>(client.get("/agreements", { params })),
  get: (id: number | string) => d<AgreementDetail>(client.get(`/agreements/${id}`)),
  create: (body: NewAgreementInput) => d<WithWarnings>(client.post("/agreements", body)),
  activate: (id: number) => d<WithWarnings>(client.post(`/agreements/${id}/activate`)),
  addRevision: (id: number, body: { effectiveFrom: string; rate: number; reason?: string }) => d<WithWarnings>(client.post(`/agreements/${id}/revisions`, body)),
  addDeposit: (id: number, body: { type: DepositType; amount: number; date: string; note?: string }) => d<WithWarnings>(client.post(`/agreements/${id}/deposits`, body)),
  giveNotice: (id: number, body: { noticeDate: string; endDate?: string }) => d<WithWarnings>(client.post(`/agreements/${id}/notice`, body)),
  settlement: (id: number, body: { endDate: string; deductions: { amount: number; note: string }[]; finalInvoice?: boolean }) =>
    d<Settlement>(client.post(`/agreements/${id}/settlement`, body)),
  end: (id: number, body: { endDate: string; deductions: { amount: number; note: string }[]; finalInvoice?: boolean; refund?: boolean }) =>
    d<WithWarnings & { due: number }>(client.post(`/agreements/${id}/end`, body)),
  remove: (id: number) => client.delete(`/agreements/${id}`),
  update: (id: number, body: { tdsPercent?: number; clauses?: string[] }) => d<AgreementDetail>(client.patch(`/agreements/${id}`, body)),
  acceptNotice: (id: number, rid: number) => d<WithWarnings>(client.post(`/agreements/${id}/notice-requests/${rid}/accept`)),
  declineNotice: (id: number, rid: number, note?: string) => d<WithWarnings>(client.post(`/agreements/${id}/notice-requests/${rid}/decline`, { note })),
  noticeRequests: (status = "PENDING") => d<{ id: number; agreementId: number; moveOutDate: string; tenant: { firstName: string; lastName: string } }[]>(client.get("/agreements/notice-requests", { params: { status } })),
};

export const AGREEMENT_STATUS: Record<AgreementStatus, { label: string; color: "default" | "success" | "warning" | "info" }> = {
  DRAFT: { label: "Draft", color: "default" },
  ACTIVE: { label: "Active", color: "success" },
  NOTICE: { label: "On notice", color: "warning" },
  ENDED: { label: "Ended", color: "info" },
};

export const DEPOSIT_LABEL: Record<DepositType, string> = {
  RECEIVED: "Received",
  ADJUSTED: "Adjusted against rent",
  DEDUCTED_DAMAGE: "Deducted (damage)",
  REFUNDED: "Refunded",
};

export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";
