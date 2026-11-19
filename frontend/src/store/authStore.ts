import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, AuthTokens, Membership } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** Workspace sent as X-Org-Id on every request. */
  currentOrgId: string | null;
  setCurrentOrg: (orgId: string) => void;
  setAuth: (user: User, tokens: AuthTokens) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

/** Keep the chosen workspace if the user still belongs to it, else the first one. */
const pickOrg = (memberships: Membership[] | undefined, current: string | null) =>
  memberships?.some((m) => m.orgId === current) ? current : memberships?.[0]?.orgId ?? null;

/** The membership for the workspace in use (role drives what the UI shows). */
export const useCurrentMembership = () =>
  useAuthStore((s) => s.user?.memberships?.find((m) => m.orgId === s.currentOrgId) ?? s.user?.memberships?.[0] ?? null);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentOrgId: null,

      setCurrentOrg: (orgId) => set({ currentOrgId: orgId }),

      setAuth: (user, tokens) =>
        set((s) => ({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
          currentOrgId: pickOrg(user.memberships, s.currentOrgId),
        })),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set((s) => ({ user, currentOrgId: pickOrg(user.memberships, s.currentOrgId) })),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          currentOrgId: null,
        }),
    }),
    {
      name: "renthub-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        currentOrgId: state.currentOrgId,
      }),
    }
  )
);
