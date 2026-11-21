import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Tenant portal session. Separate from the staff store so the two logins never mix. */
interface PortalState {
  phone: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (s: { phone: string; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      phone: null,
      accessToken: null,
      refreshToken: null,
      setSession: (s) => set(s),
      logout: () => set({ phone: null, accessToken: null, refreshToken: null }),
    }),
    { name: "renthub-portal" }
  )
);
