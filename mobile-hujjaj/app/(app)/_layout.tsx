import { Stack } from 'expo-router';
import { colors } from '@/src/theme/tokens';

export default function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.ivory,
        headerTitleStyle: { fontWeight: '700', color: colors.ivory },
        contentStyle: { backgroundColor: colors.sand },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="booking/new" options={{ title: '' }} />
      <Stack.Screen name="bookings/index" options={{ title: '' }} />
      <Stack.Screen name="bookings/[id]" options={{ title: '' }} />
      <Stack.Screen name="clients/index" options={{ title: '' }} />
      <Stack.Screen name="clients/[id]" options={{ title: '' }} />
      <Stack.Screen name="pilgrims/index" options={{ title: '' }} />
      <Stack.Screen name="pilgrims/[id]" options={{ title: '' }} />
      <Stack.Screen name="messages/index" options={{ title: '' }} />
      <Stack.Screen name="settings/index" options={{ title: '' }} />
      <Stack.Screen name="seasons/[id]" options={{ title: '' }} />
    </Stack>
  );
}
