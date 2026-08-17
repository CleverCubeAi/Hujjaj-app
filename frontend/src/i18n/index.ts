import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../locales/ar/translation.json';
import fr from '../locales/fr/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      fr: { translation: fr }
    },
    lng: 'ar',
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
