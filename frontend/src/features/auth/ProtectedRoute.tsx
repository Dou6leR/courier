import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { UserRole } from "./types";

export function ProtectedRoute({
  role,
  children,
}: {
  role?: UserRole;
  children: ReactNode;
}) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Завантаження…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && !hasRole(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
