import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, DirectionProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import i18n from './i18n';
import { AuthProvider } from './providers/AuthProvider';
import { BrandingProvider } from './providers/BrandingProvider';
import { appTheme } from './theme/brand';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

// Component to handle direction changes dynamically
const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [dir, setDir] = React.useState<'rtl' | 'ltr'>(i18n.language === 'ar' ? 'rtl' : 'ltr');

  React.useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setDir(lng === 'ar' ? 'rtl' : 'ltr');
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
    };

    i18n.on('languageChanged', handleLanguageChange);
    // Initial set
    handleLanguageChange(i18n.language);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return (
    <DirectionProvider initialDirection={dir}>
      <MantineProvider theme={appTheme}>
        <Notifications position="top-right" />
        {children}
      </MantineProvider>
    </DirectionProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AuthProvider>
          <BrandingProvider>
            <AppProvider>
              <App />
            </AppProvider>
          </BrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  </React.StrictMode>
);
