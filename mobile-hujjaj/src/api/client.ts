import { clearSession, getAccessToken, getRefreshToken, saveTokens, saveUser } from '../auth/session';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh_token = await getRefreshToken();
      if (!refresh_token) return false;
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access_token || !data.refresh_token) return false;
      await saveTokens(data.access_token, data.refresh_token);
      if (data.user) await saveUser(data.user);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function parseError(res: Response) {
  const body = await res.json().catch(() => ({ error: 'Request failed' }));
  return new ApiError(res.status, body.error || body.error_en || 'Request failed');
}

export async function request<T = any>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, options, true);
    await clearSession();
    onUnauthorized?.();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function requestMultipart<T = any>(path: string, formData: FormData, retried = false): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });
  if (res.status === 401 && !retried) {
    const ok = await tryRefresh();
    if (ok) return requestMultipart<T>(path, formData, true);
    await clearSession();
    onUnauthorized?.();
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function downloadFile(path: string, filename: string) {
  const FileSystem = await import('expo-file-system/legacy');
  const token = await getAccessToken();
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  const result = await FileSystem.downloadAsync(`${API_URL}${path}`, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (result.status >= 400) throw new ApiError(result.status, 'Download failed');
  return result.uri;
}

export { tryRefresh };
