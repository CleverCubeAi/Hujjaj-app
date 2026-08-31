import * as SecureStore from 'expo-secure-store';

const ACCESS = 'hujjaj_access';
const REFRESH = 'hujjaj_refresh';
const USER = 'hujjaj_user';

export type AuthUser = {
  id: string;
  email: string;
  user_metadata?: {
    agency_id?: string | null;
    role?: string | null;
    branch_id?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  };
};

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH);
}

export async function saveUser(user: AuthUser) {
  await SecureStore.setItemAsync(USER, JSON.stringify(user));
}

export async function getCachedUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
    SecureStore.deleteItemAsync(USER),
  ]);
}

export function userRole(user?: AuthUser | null) {
  return user?.user_metadata?.role || '';
}
