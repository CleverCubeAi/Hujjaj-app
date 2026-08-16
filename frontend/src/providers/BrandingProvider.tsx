import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type PublicBranding = {
  app_name: string;
  app_name_ar: string;
  app_name_fr: string;
  tagline_ar?: string | null;
  tagline_fr?: string | null;
  logo_url?: string | null;
  logo_mark_url?: string | null;
  favicon_url?: string | null;
  login_background_url?: string | null;
  primary_color: string;
  accent_color: string;
  support_email?: string | null;
  support_phone?: string | null;
  default_locale: 'ar' | 'fr';
  legal_name?: string | null;
  copyright?: string | null;
};

const DEFAULT_BRANDING: PublicBranding = {
  app_name: 'Hujjaj',
  app_name_ar: 'حجاج',
  app_name_fr: 'Hujjaj',
  primary_color: '#8B7355',
  accent_color: '#6F5C45',
  default_locale: 'ar',
};

const BrandingContext = createContext<PublicBranding>(DEFAULT_BRANDING);

export function useBranding() {
  return useContext(BrandingContext);
}

function applyBranding(b: PublicBranding, lang: string) {
  const name = lang === 'fr' ? b.app_name_fr : b.app_name_ar;
  document.title = name || b.app_name;
  document.documentElement.style.setProperty('--accent-primary', b.primary_color || '#8B7355');
  document.documentElement.style.setProperty('--accent-secondary', b.accent_color || '#6F5C45');
  const favicon = b.favicon_url || b.logo_mark_url;
  if (favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<PublicBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    api.getPublicBranding()
      .then((data) => {
        const next = { ...DEFAULT_BRANDING, ...data };
        setBranding(next);
        applyBranding(next, document.documentElement.lang || 'ar');
      })
      .catch(() => applyBranding(DEFAULT_BRANDING, document.documentElement.lang || 'ar'));
  }, []);

  useEffect(() => {
    applyBranding(branding, document.documentElement.lang || 'ar');
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}
