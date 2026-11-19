import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, useCurrentMembership } from "@/store/authStore";
import type { OrgRole } from "@/types";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
  /** Workspace roles allowed (the API enforces the same rules). */
  orgRoles?: OrgRole[];
}

export const ProtectedRoute = ({ children, roles, orgRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuthStore();
  const membership = useCurrentMembership();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if ((roles && user && !roles.includes(user.role)) || (orgRoles && !(membership && orgRoles.includes(membership.role)))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
