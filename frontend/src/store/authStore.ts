import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, AuthTokens, Membership } from "@/types";

interface AuthState {
  user: User | null;
  /** in memory only: after a reload the first request refreshes it from the httpOnly cookie */
  accessToken: string | null;
  isAuthenticated: boolean;
  /** Workspace sent as X-Org-Id on every request. */
  currentOrgId: string | null;
  setCurrentOrg: (orgId: string) => void;
  setAuth: (user: User, tokens: AuthTokens) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  /**
   * Super-admin "open as owner" (read-only). In memory only, never persisted: a reload ends it.
   * While set, requests use its token and workspace, and the UI acts as that workspace's owner.
   */
  support: { orgId: string; orgName: string; accessToken: string } | null;
  startSupport: (s: { orgId: string; orgName: string; accessToken: string }) => void;
  endSupport: () => void;
}

/** Keep the chosen workspace if the user still belongs to it, else the first one. */
const pickOrg = (memberships: Membership[] | undefined, current: string | null) =>
  memberships?.some((m) => m.orgId === current) ? current : memberships?.[0]?.orgId ?? null;

/** The membership for the workspace in use (role drives what the UI shows). */
export const useCurrentMembership = () =>
  useAuthStore((s) =>
    s.support
      ? SUPPORT_MEMBERSHIP(s.support)
      : s.user?.memberships?.find((m) => m.orgId === s.currentOrgId) ?? s.user?.memberships?.[0] ?? null);

// one object per support session, so the selector above stays referentially stable
let lastSupport: { key: string; m: Membership } | null = null;
const SUPPORT_MEMBERSHIP = (s: { orgId: string; orgName: string }) => {
  if (lastSupport?.key !== s.orgId) lastSupport = { key: s.orgId, m: { orgId: s.orgId, orgName: s.orgName, role: "OWNER" } };
  return lastSupport.m;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      currentOrgId: null,

      setCurrentOrg: (orgId) => set({ currentOrgId: orgId }),
      support: null,
      startSupport: (support) => set({ support }),
      endSupport: () => set({ support: null }),

      setAuth: (user, tokens) =>
        set((s) => ({
          user,
          accessToken: tokens.accessToken,
          isAuthenticated: true,
          currentOrgId: pickOrg(user.memberships, s.currentOrgId),
        })),

      setAccessToken: (accessToken) => set({ accessToken }),

      setUser: (user) => set((s) => ({ user, currentOrgId: pickOrg(user.memberships, s.currentOrgId) })),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          support: null,
          isAuthenticated: false,
          currentOrgId: null,
        }),
    }),
    {
      name: "renthub-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        currentOrgId: state.currentOrgId,
      }),
    }
  )
);
