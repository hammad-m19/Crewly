import { useAuthStore } from '../store/authStore';

/**
 * API base URL — update this in production.
 * During development, use your local machine's IP (not localhost)
 * because the app runs on a device/emulator.
 */
const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:3000/api' // Change to your dev machine's IP
  : 'https://api.crewly.app/api';   // Production URL

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip auth header (for login/refresh endpoints) */
  skipAuth?: boolean;
}

/**
 * API client — handles auth header injection, token refresh, and error handling.
 */
export async function apiFetch<T>(
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
        // Retry the original request with the new token
        return apiFetch<T>(endpoint, options);
      }
      // Refresh failed — force logout
      await useAuthStore.getState().logout();
    }

    return data;
  } catch (error) {
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
