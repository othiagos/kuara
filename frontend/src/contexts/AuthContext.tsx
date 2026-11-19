import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

export interface ProviderProfile {
  id: string;
  cpfCnpj: string;
  pixKey: string;
  bio?: string | null;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "SUSPENDED";
  rejectionReason?: string | null;
  documentUrl?: string | null;
  addressProofUrl?: string | null;
  ratingAverage: number;
  ratingCount: number;
  categories: string[];
  serviceAreas: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: "CLIENT" | "PROVIDER" | "ADMIN";
  ratingAverage?: number;
  ratingCount?: number;
  providerProfile?: ProviderProfile | null;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const TOKEN_KEY = "@kuara:token";
const USER_KEY = "@kuara:user";

const clearStoredSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage access errors
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const login = useCallback((token: string, userData: User) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch {
      // Ignore storage access errors
    }
    setUser(userData);
  }, []);

  const reloadUser = useCallback(async () => {
    try {
      const res = await api.get<User>("/auth/me");
      setUser(res.data);
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      } catch {
        // Ignore storage access errors
      }
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    let token: string | null = null;
    let storedUser: string | null = null;

    try {
      token = localStorage.getItem(TOKEN_KEY);
      storedUser = localStorage.getItem(USER_KEY);
    } catch {
      setLoading(false);
      return;
    }

    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User;
        if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.role) {
          clearStoredSession();
          setLoading(false);
          return;
        }
        setUser(parsed);
      } catch {
        clearStoredSession();
        setLoading(false);
        return;
      }

      reloadUser().finally(() => setLoading(false));
    } else {
      if (token || storedUser) {
        clearStoredSession();
      }
      setLoading(false);
    }
  }, [reloadUser]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
