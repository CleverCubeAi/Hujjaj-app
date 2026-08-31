import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth/AuthProvider';

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={'/(app)/(tabs)' as import('expo-router').Href} />;
}
