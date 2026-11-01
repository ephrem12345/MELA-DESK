"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@/lib/api/types";
import { authApi, ApiError, isMockMode } from "@/lib/api/client";
import { verifyMockCredentials } from "@/lib/api/mock";

interface SessionValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (p: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (isMockMode()) {
      try {
        const raw = window.localStorage.getItem("mela-mock-user");
        setUser(raw ? (JSON.parse(raw) as User) : null);
      } catch {
        window.localStorage.removeItem("mela-mock-user");
        setUser(null);
      }
      setLoading(false);
      return;
    }

    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    if (isMockMode()) {
      const u = verifyMockCredentials(email, password);
      if (!u) throw new ApiError(401, "UNAUTHENTICATED", "invalidCredentials");
      window.localStorage.setItem("mela-mock-user", JSON.stringify(u));
      setUser(u);
      return u;
    }
    const { user } = await authApi.login(email, password);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (p: { name: string; email: string; password: string }) => {
    if (isMockMode()) {
      const u: User = {
        id: `u-${Date.now()}`,
        name: p.name,
        email: p.email,
        role: "REQUESTER",
        teamId: null,
        teamName: null,
        createdAt: new Date().toISOString(),
        active: true,
      };
      window.localStorage.setItem("mela-mock-user", JSON.stringify(u));
      setUser(u);
      return u;
    }
    const { user } = await authApi.register(p);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    if (!isMockMode()) await authApi.logout();
    window.localStorage.removeItem("mela-mock-user");
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, login, register, logout }), [user, loading, refresh, login, register, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Fallback mock user for clearly-labeled UI development when no session exists. */
export function useMockUserFallback(fallbackRole: User["role"] = "REQUESTER"): User {
  return {
    id: "mock-user",
    name: fallbackRole === "ADMIN" ? "Admin User" : `Demo ${fallbackRole.charAt(0) + fallbackRole.slice(1).toLowerCase()}`,
    email: "demo@meladesk.test",
    role: fallbackRole,
    teamId: fallbackRole === "REQUESTER" ? null : "t-1",
    teamName: fallbackRole === "REQUESTER" ? null : "Service Desk",
    createdAt: new Date().toISOString(),
    active: true,
  };
}
