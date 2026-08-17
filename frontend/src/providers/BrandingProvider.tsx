import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LEGACY_ACCENT, LEGACY_APP_NAMES, LEGACY_PRIMARY } from '../theme/brand';

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
  app_name: 'Hajj & Umrah Agency Pro',
  app_name_ar: 'الحج والعمرة — وكالة برو',
  app_name_fr: 'Hajj & Umrah Agency Pro',
  tagline_ar: 'سافر • احجز • اعتمر',
  tagline_fr: 'Travel • Book • Pilgrimage',
  primary_color: '#063F46',
  accent_color: '#C99A3D',
  default_locale: 'ar',
};

function mergeBranding(data: Partial<PublicBranding> = {}): PublicBranding {
  const next = { ...DEFAULT_BRANDING, ...data };
  if (!next.primary_color || LEGACY_PRIMARY.has(next.primary_color)) {
    next.primary_color = DEFAULT_BRANDING.primary_color;
  }
  if (!next.accent_color || LEGACY_ACCENT.has(next.accent_color)) {
    next.accent_color = DEFAULT_BRANDING.accent_color;
  }
  if (!next.app_name || LEGACY_APP_NAMES.has(next.app_name)) {
    next.app_name = DEFAULT_BRANDING.app_name;
  }
  if (!next.app_name_ar || LEGACY_APP_NAMES.has(next.app_name_ar)) {
    next.app_name_ar = DEFAULT_BRANDING.app_name_ar;
  }
  if (!next.app_name_fr || LEGACY_APP_NAMES.has(next.app_name_fr)) {
    next.app_name_fr = DEFAULT_BRANDING.app_name_fr;
  }
  if (!next.tagline_ar) next.tagline_ar = DEFAULT_BRANDING.tagline_ar;
  if (!next.tagline_fr) next.tagline_fr = DEFAULT_BRANDING.tagline_fr;
  return next;
}

const BrandingContext = createContext<PublicBranding>(DEFAULT_BRANDING);

export function useBranding() {
  return useContext(BrandingContext);
}

function applyBranding(b: PublicBranding, lang: string) {
  const name = lang === 'fr' ? b.app_name_fr : b.app_name_ar;
  document.title = name || b.app_name;
  document.documentElement.style.setProperty('--accent-primary', b.primary_color || '#063F46');
  document.documentElement.style.setProperty('--accent-secondary', b.accent_color || '#C99A3D');
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
        const next = mergeBranding(data);
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
