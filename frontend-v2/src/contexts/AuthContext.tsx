import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import api, { setAccessToken, bootstrapSession } from "../lib/api";

type Role = "admin" | "teknisi" | "kasir";

interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  /** true saat masih memeriksa sesi (refresh cookie) di awal load */
  bootstrapping: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // User di state (memory) — TIDAK di localStorage. Refresh token di httpOnly cookie.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Bootstrap: coba /auth/refresh — kalau cookie masih valid, sesi langsung pulih
  // (user tidak perlu login ulang, dan tidak ada token XSS-able di storage).
  // Single-flight via bootstrapSession(): aman dari double-invoke StrictMode.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await bootstrapSession();
      if (!cancelled && session) {
        setAccessToken(session.token);
        setUser(session.user as AuthUser);
      }
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((u: AuthUser, t: string) => {
    setAccessToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/v2/auth/logout");
    } catch {
      // tetap logout lokal walau server error
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user, bootstrapping }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}