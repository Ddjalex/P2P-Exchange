import React, { createContext, useContext, useEffect, useState } from "react";
import { getAdminToken, setAdminToken, adminGet } from "@/lib/admin-api";

interface AdminUser {
  email: string;
}

interface AdminAuthContext {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AdminAuthContext>({ admin: null, loading: true, login: async () => {}, logout: () => {} });

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setLoading(false); return; }
    adminGet<AdminUser>('/auth/me')
      .then(setAdmin)
      .catch(() => { setAdminToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(e.error || 'Login failed');
    }
    const { token, admin: adminData } = await res.json();
    setAdminToken(token);
    setAdmin(adminData);
  };

  const logout = () => {
    setAdminToken(null);
    setAdmin(null);
    window.location.href = '/auth';
  };

  return <Ctx.Provider value={{ admin, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  return useContext(Ctx);
}
