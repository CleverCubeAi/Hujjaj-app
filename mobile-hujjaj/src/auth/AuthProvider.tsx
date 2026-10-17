import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/endpoints';
import { setUnauthorizedHandler, tryRefresh } from '../api/client';
import { flushQueue } from '../offline/queue';
import {
  AuthUser,
  clearSession,
  getCachedUser,
  getRefreshToken,
  saveTokens,
  saveUser,
  userRole,
} from './session';

export type PublicBranding = {
  app_name?: string;
  app_name_ar?: string;
  app_name_fr?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
};

export type SessionBranding = {
  kind?: string;
  name?: string;
  name_ar?: string;
  logo_url?: string | null;
  primary_color?: string | null;
};

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
  publicBranding: PublicBranding | null;
  sessionBranding: SessionBranding | null;
  blockedSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshBranding: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [publicBranding, setPublicBranding] = useState<PublicBranding | null>(null);
  const [sessionBranding, setSessionBranding] = useState<SessionBranding | null>(null);
  const [blockedSuperAdmin, setBlockedSuperAdmin] = useState(false);

  const applyUser = useCallback(async (next: AuthUser | null) => {
    if (next && userRole(next) === 'super_admin') {
      await clearSession();
      setUser(null);
      setSessionBranding(null);
      setBlockedSuperAdmin(true);
      return;
    }
    setBlockedSuperAdmin(false);
    setUser(next);
    if (next) {
      await saveUser(next);
      try {
        setSessionBranding(await api.sessionBranding());
      } catch {
        setSessionBranding(null);
      }
    } else {
      setSessionBranding(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = await getRefreshToken();
      await api.logout(refresh);
    } catch {
      // still clear local
    }
    await clearSession();
    setUser(null);
    setSessionBranding(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSessionBranding(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const branding = await api.publicBranding();
        if (!cancelled) setPublicBranding(branding);
      } catch {
        if (!cancelled) setPublicBranding({ app_name_ar: 'حجاج', app_name_fr: 'Hujjaj' });
      }
      const cached = await getCachedUser();
      const refresh = await getRefreshToken();
      if (refresh) {
        const ok = await tryRefresh();
        if (ok) {
          try {
            const me = await api.me();
            if (!cancelled) await applyUser(me.user);
          } catch {
            if (cached && !cancelled) await applyUser(cached);
          }
        } else if (cached && !cancelled) {
          await applyUser(cached);
        }
      }
      if (!cancelled) {
        setReady(true);
        flushQueue().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const login = useCallback(async (email: string, password: string) => {
    setBlockedSuperAdmin(false);
    const data = await api.login(email.trim(), password);
    if (userRole(data.user) === 'super_admin') {
      setBlockedSuperAdmin(true);
      throw new Error('super_admin');
    }
    if (!data.access_token || !data.refresh_token) {
      throw new Error('Mobile tokens missing from login response');
    }
    await saveTokens(data.access_token, data.refresh_token);
    await applyUser(data.user);
  }, [applyUser]);

  const refreshBranding = useCallback(async () => {
    try {
      setPublicBranding(await api.publicBranding());
    } catch {
      /* keep previous */
    }
    if (user) {
      try {
        setSessionBranding(await api.sessionBranding());
      } catch {
        /* keep previous */
      }
    }
  }, [user]);

  const value = useMemo(
    () => ({ ready, user, publicBranding, sessionBranding, blockedSuperAdmin, login, logout, refreshBranding }),
    [ready, user, publicBranding, sessionBranding, blockedSuperAdmin, login, logout, refreshBranding],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
