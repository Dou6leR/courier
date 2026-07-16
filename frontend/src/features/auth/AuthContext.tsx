import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api";
import {
  getAccessToken,
  setAccessToken,
  setOnUnauthorized,
} from "@/lib/api";
import type { UserMe, UserRole } from "./types";

interface AuthContextValue {
  user: UserMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  setToken: (token: string | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getAccessToken());
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (token) {
      setBootstrapped(true);
      return;
    }
    const timeout = setTimeout(() => {
      if (!cancelled) setBootstrapped(true);
    }, 2500);
    authApi
      .refresh()
      .then((res) => {
        clearTimeout(timeout);
        if (cancelled) return;
        setAccessToken(res.access_token);
        setTokenState(res.access_token);
      })
      .catch(() => {
        clearTimeout(timeout);
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setToken = useCallback(
    (next: string | null) => {
      setAccessToken(next);
      setTokenState(next);
      if (!next) {
        qc.removeQueries({ queryKey: ["auth", "me"] });
      } else {
        qc.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    },
    [qc],
  );

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: bootstrapped && !!token,
    staleTime: 60_000,
  });

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
  }, [setToken]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
    });
    return () => setOnUnauthorized(null);
  }, [setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: !bootstrapped || (!!token && meQuery.isLoading),
      isAuthenticated: !!token && !!meQuery.data,
      hasRole: (role) => !!meQuery.data?.roles.includes(role),
      setToken,
      logout,
    }),
    [bootstrapped, token, meQuery.data, meQuery.isLoading, setToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
