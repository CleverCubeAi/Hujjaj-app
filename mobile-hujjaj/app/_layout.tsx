import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, useFonts } from '@expo-google-fonts/tajawal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type Href, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, View } from 'react-native';
import { AuthProvider, useAuth } from '@/src/auth/AuthProvider';
import { initI18n } from '@/src/i18n';
import { colors } from '@/src/theme/tokens';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export { ErrorBoundary } from 'expo-router';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inLogin = segments[0] === 'login';
    if (!user && !inLogin) router.replace('/login');
    if (user && inLogin) router.replace('/(app)/(tabs)' as Href);
  }, [ready, user, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && i18nReady) SplashScreen.hideAsync();
  }, [fontsLoaded, i18nReady]);

  if (!fontsLoaded || !i18nReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Gate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.sand },
              animation: I18nManager.isRTL ? 'slide_from_left' : 'slide_from_right',
            }}
          >
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" />
          </Stack>
        </Gate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
