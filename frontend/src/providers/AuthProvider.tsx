import React, { createContext, useContext, useEffect, useState } from 'react';

const TOKEN_KEY = 'hujjaj_token';
const USER_KEY = 'hujjaj_user';

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

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  agencyId: string | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ data?: any; error?: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function loadStoredSession(): AuthSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (!token || !userRaw) return null;
    return { access_token: token, user: JSON.parse(userRaw) };
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadStoredSession();
    if (stored) {
      setSession(stored);
      setUser(stored.user);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, pass: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const body = await res.json();
      if (!res.ok) {
        return { error: new Error(body.error || 'Login failed') };
      }

      const next: AuthSession = {
        access_token: body.access_token || body.token,
        user: body.user,
      };
      persistSession(next);
      setSession(next);
      setUser(next.user);
      return { data: body, error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error('Login failed') };
    }
  };

  const signOut = async () => {
    persistSession(null);
    setSession(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    session,
    agencyId: user?.user_metadata?.agency_id || null,
    role: user?.user_metadata?.role || null,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
