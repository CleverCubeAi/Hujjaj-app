import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ar } from './ar';
import { fr } from './fr';

export const LANG_KEY = 'hujjaj_lang';

export function isRtlLang(lang: string) {
  return lang.startsWith('ar');
}

export async function applyRtl(lang: string) {
  const rtl = isRtlLang(lang);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

export async function loadSavedLanguage(): Promise<string> {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  if (saved === 'ar' || saved === 'fr') return saved;
  const device = Localization.getLocales()[0]?.languageCode || 'ar';
  return device.startsWith('fr') ? 'fr' : 'ar';
}

export async function persistLanguage(lang: 'ar' | 'fr') {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
  await applyRtl(lang);
}

export async function initI18n() {
  const lng = await loadSavedLanguage();
  await applyRtl(lng);
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { ar: { translation: ar }, fr: { translation: fr } },
      lng,
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
    });
  } else {
    await i18n.changeLanguage(lng);
  }
  return lng;
}

export default i18n;
