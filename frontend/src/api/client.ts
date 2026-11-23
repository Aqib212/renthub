import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const { accessToken, currentOrgId, support } = useAuthStore.getState();
  // support view: the super-admin's read-only token for that workspace
  const token = support?.accessToken ?? accessToken;
  const orgId = support?.orgId ?? currentOrgId;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (orgId) config.headers["X-Org-Id"] = orgId;
  return config;
});

/**
 * One refresh at a time: the refresh token rotates, so parallel 401s (e.g. every query after a reload,
 * when the access token is only in memory) must share one call or the second would log the user out.
 */
let refreshing: Promise<string | null> | null = null;
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh-token", "/auth/logout", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email", "/auth/resend-otp"];
const refresh = () =>
  (refreshing ??= (async () => {
    if (!useAuthStore.getState().isAuthenticated) return null;
    try {
      // the httpOnly refresh cookie goes along by itself
      const r = await axios.post("/api/v1/auth/refresh-token");
      const accessToken = r.data.data.accessToken as string;
      useAuthStore.getState().setAccessToken(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })());

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // support view: an expired support token, or the end of a read-only session -> back to the console
    const st = useAuthStore.getState();
    if (st.support && error.response?.status === 401) {
      st.endSupport();
      window.location.href = "/admin";
      return Promise.reject(error);
    }
    // a 401 from these means wrong credentials or no session, not an expired access token
    const isAuthCall = NO_REFRESH.includes(String(originalRequest?.url ?? ""));
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
      originalRequest._retry = true;
      const accessToken = await refresh();
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      }
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: any) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  changePassword: (data: any) => api.post("/auth/change-password", data),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) => api.post("/auth/reset-password", { token, password }),
  verifyEmail: (email: string, otp: string) => api.post("/auth/verify-email", { email, otp }),
  resendOtp: (email: string) => api.post("/auth/resend-otp", { email }),
  getProfile: () => api.get("/auth/profile"),
  updateProfile: (data: { firstName: string; lastName: string; phone: string }) => api.patch("/auth/profile", data),
  requestEmailChange: (data: { newEmail: string; password: string }) => api.post("/auth/email/change", data),
  confirmEmailChange: (otp: string) => api.post("/auth/email/confirm", { otp }),
};
