import axios from "axios";
import { usePortalStore } from "@/store/portalStore";

/** Axios instance for the tenant portal (/api/v1/portal): tenant token, one refresh on 401. */
const portal = axios.create({ baseURL: "/api/v1/portal" });

portal.interceptors.request.use((config) => {
  const t = usePortalStore.getState().accessToken;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
const refresh = () =>
  (refreshing ??= (async () => {
    const rt = usePortalStore.getState().refreshToken;
    if (!rt) return null;
    try {
      const r = await axios.post("/api/v1/portal/auth/refresh", { refreshToken: rt });
      usePortalStore.getState().setSession(r.data.data);
      return r.data.data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })());

portal.interceptors.response.use(
  (r) => r,
  async (error) => {
    const req = error.config;
    if (error.response?.status === 401 && !req._retry && !String(req.url).startsWith("/auth/")) {
      req._retry = true;
      const token = await refresh();
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
        return portal(req);
      }
      usePortalStore.getState().logout();
      window.location.href = "/portal/login";
    }
    return Promise.reject(error);
  }
);

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export type ClaimMethod = "BKASH" | "NAGAD" | "ROCKET" | "BANK" | "CHEQUE";
export interface OpenInvoice { id: number; month: number; year: number; totalAmount: number; paidAmount: number; dueAmount: number; status: string; dueDate: string | null; shareToken: string | null }
export interface Tenancy {
  agreementId: number;
  status: "ACTIVE" | "NOTICE" | "ENDED";
  org: { id: number; name: string; payInfo: string };
  unit: { name: string; floorName: string; building: { name: string; address: string | null } } | null;
  vehicle?: { regNo: string; type: string } | null;
  cycle?: "MONTHLY" | "DAILY";
  rent: number;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  depositBalance: number;
  openDues: number;
  openInvoice: OpenInvoice | null;
  pendingNotice: { id: number; moveOutDate: string; createdAt: string } | null;
}
export interface Claim {
  id: number; invoiceId: number; amount: number; method: ClaimMethod; transactionId: string; paidOn: string; note: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED"; reviewNote: string | null; createdAt: string; period: string;
  receipt: { receiptNo: string | null; shareToken: string | null } | null;
}
export interface PortalHome { phone: string; name: string; lang: "BN" | "EN"; tenancies: Tenancy[]; claims: Claim[] }
export interface PortalInvoice extends OpenInvoice { carriedForward: boolean }
export interface PortalPayment { id: number; receiptNo: string | null; amount: number; method: string; transactionId: string | null; date: string; shareToken: string | null; invoice: { month: number; year: number } }
export interface PortalRepair { id: number; title: string; description: string | null; category: string | null; status: string; createdAt: string; resolvedAt: string | null; unit: string | null; photos: number[] }

export const portalApi = {
  requestOtp: (phone: string, lang: "BN" | "EN") => d<{ message: string }>(portal.post("/auth/request-otp", { phone, lang })),
  verifyOtp: (phone: string, code: string) => d<{ accessToken: string; refreshToken: string; phone: string }>(portal.post("/auth/verify-otp", { phone, code })),
  logout: () => portal.post("/auth/logout").catch(() => {}),
  home: () => d<PortalHome>(portal.get("/home")),
  invoices: (agreementId: number) => d<PortalInvoice[]>(portal.get("/invoices", { params: { agreementId } })),
  payments: (agreementId: number) => d<PortalPayment[]>(portal.get("/payments", { params: { agreementId } })),
  agreement: (id: number | string) => d<any>(portal.get(`/agreements/${id}`)),
  claim: (body: { invoiceId: number; amount: number; method: ClaimMethod; transactionId: string; paidOn: string; note?: string }) => d<Claim>(portal.post("/claims", body)),
  notice: (body: { agreementId: number; moveOutDate: string; reason?: string }) => d<{ warnings: string[] }>(portal.post("/notice", body)),
  withdrawNotice: (id: number) => portal.delete(`/notice/${id}`),
  repairs: () => d<PortalRepair[]>(portal.get("/maintenance")),
  reportRepair: (body: { agreementId: number; title: string; description?: string; category?: string }) => d<{ id: number }>(portal.post("/maintenance", body)),
  addPhotos: (id: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f));
    return portal.post(`/maintenance/${id}/photos`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  photoUrl: async (id: number) => URL.createObjectURL((await portal.get(`/files/${id}`, { responseType: "blob" })).data as Blob),
};
