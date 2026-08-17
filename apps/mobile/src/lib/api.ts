import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

/**
 * API base URL — update this in production.
 * iOS Simulator and Android emulator can reach the host machine directly.
 * On a physical device, replace localhost with your computer's LAN IP.
 */
function getDevApiBaseUrl(): string {
  if (Platform.OS === 'ios') {
    return 'http://localhost:3000/api';
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}

const API_BASE_URL = __DEV__
  ? getDevApiBaseUrl()
  : 'https://crewly-bepo.onrender.com/api';

/** GET-only retries for transient network failures */
const GET_MAX_ATTEMPTS = 3;
const GET_BACKOFF_MS = 400;

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip auth header (for login/refresh endpoints) */
  skipAuth?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API client — handles auth header injection, token refresh, and error handling.
 * GET requests retry with exponential backoff on transient network failures only.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ success: boolean; data?: T; error?: { message: string; code?: string } }> {
  const method = options.method ?? 'GET';
  const maxAttempts = method === 'GET' ? GET_MAX_ATTEMPTS : 1;

  let lastNetworkError: { success: false; error: { message: string; code: string } } | null =
    null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await apiFetchOnce<T>(endpoint, options);

    if (result.success || result.error?.code !== 'NETWORK_ERROR') {
      return result;
    }

    lastNetworkError = result as {
      success: false;
      error: { message: string; code: string };
    };

    if (attempt < maxAttempts) {
      await sleep(GET_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }

  return (
    lastNetworkError ?? {
      success: false,
      error: {
        message: 'Network error. You may be offline.',
        code: 'NETWORK_ERROR',
      },
    }
  );
}

async function apiFetchOnce<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ success: boolean; data?: T; error?: { message: string; code?: string } }> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    // Handle token expiration — attempt refresh
    if (response.status === 401 && data?.error?.code === 'TOKEN_EXPIRED' && !skipAuth) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        // Retry the original request with the new token (does not count as network backoff)
        return apiFetchOnce<T>(endpoint, options);
      }
      // Refresh failed — force logout
      await useAuthStore.getState().logout();
    }

    return data;
  } catch {
    // Network error — expected when offline
    return {
      success: false,
      error: {
        message: 'Network error. You may be offline.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.data?.token) {
      await useAuthStore.getState().updateToken(data.data.token);
      return true;
    }
  } catch {
    // Refresh failed — will fall through to logout
  }

  return false;
}

export { API_BASE_URL };
