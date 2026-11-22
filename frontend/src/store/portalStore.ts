import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Tenant portal session. Separate from the staff store so the two logins never mix. */
/** `phone` is remembered; the access token is in memory only (the refresh token is an httpOnly cookie). */
interface PortalState {
  phone: string | null;
  accessToken: string | null;
  setSession: (s: { phone: string; accessToken: string }) => void;
  logout: () => void;
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      phone: null,
      accessToken: null,
      setSession: (s) => set({ phone: s.phone, accessToken: s.accessToken }),
      logout: () => set({ phone: null, accessToken: null }),
    }),
    { name: "renthub-portal", partialize: (s) => ({ phone: s.phone }) }
  )
);
