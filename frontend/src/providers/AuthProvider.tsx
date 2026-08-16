import React, { createContext, useContext, useEffect, useState } from 'react';

const USER_KEY = 'hujjaj_user';
const AUTH_FLAG = 'hujjaj_auth';

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    agency_id?: string | null;
    role?: string | null;
    branch_id?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  agencyId: string | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ data?: any; error?: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function getAccessToken(): string | null {
  return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = (next: AuthUser | null) => {
    setUser(next);
    if (next) {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      localStorage.setItem(AUTH_FLAG, '1');
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(AUTH_FLAG);
    }
  };

  const loadMe = async () => {
    const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
    if (!res.ok) {
      applyUser(null);
      return false;
    }
    const body = await res.json();
    applyUser(body.user);
    return true;
  };

  useEffect(() => {
    loadMe().finally(() => setLoading(false));

    const onUnauthorized = () => {
      applyUser(null);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_FLAG && !e.newValue) applyUser(null);
    };
    window.addEventListener('hujjaj:unauthorized', onUnauthorized);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('hujjaj:unauthorized', onUnauthorized);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const body = await res.json();
      if (!res.ok) {
        return { error: new Error(body.error || 'Login failed') };
      }
      applyUser(body.user);
      return { data: body, error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error('Login failed') };
    }
  };

  const signOut = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // still clear local state
    }
    applyUser(null);
  };

  const value: AuthContextType = {
    user,
    session: user ? { user } : null,
    agencyId: user?.user_metadata?.agency_id || null,
    role: user?.user_metadata?.role || null,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
