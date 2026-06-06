import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  uid: string | null;
  username: string;
  email: string;
  phone: string | null;
  country: string;
  kycStatus: string;
  isMerchant: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

const TOKEN_KEY = "p2p_token";
const POLL_INTERVAL_MS = 20_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMe = useCallback(async (): Promise<AuthUser | null> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return res.json();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await fetchMe();
      if (data) {
        setUser(prev => {
          if (!prev) return data;
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      } else {
        setUser(null);
      }
    } catch {}
  }, [fetchMe]);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    return () => setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    fetchMe()
      .then(data => {
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) refreshUser();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) refreshUser();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshUser]);

  const login = useCallback((token: string, userData: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setLocation("/auth");
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
