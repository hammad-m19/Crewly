import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Role } from '@crewly/shared';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedSites: string[];
}

interface AuthState {
  /** Current authenticated user */
  user: AuthUser | null;
  /** JWT access token */
  token: string | null;
  /** JWT refresh token */
  refreshToken: string | null;
  /** Whether we've checked stored credentials on app launch */
  isInitialized: boolean;
  /** Whether a login/logout operation is in progress */
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (token: string, refreshToken: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateToken: (token: string) => Promise<void>;
}

const TOKEN_KEY = 'crewly_auth_token';
const REFRESH_TOKEN_KEY = 'crewly_refresh_token';
const USER_KEY = 'crewly_user';

/**
 * Auth store — manages authentication state.
 * Tokens stored in SecureStore (encrypted on-device storage).
 * User data stored in SecureStore for offline access.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isInitialized: false,
  isLoading: false,

  /**
   * Called on app launch — restores stored credentials.
   * If tokens exist, user can proceed offline without re-authenticating.
   */
  initialize: async () => {
    try {
      const [token, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson) as AuthUser;
        set({ token, refreshToken, user, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isInitialized: true });
    }
  },

  /**
   * Store credentials after successful login.
   */
  login: async (token: string, refreshToken: string, user: AuthUser) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, token),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);

      set({ token, refreshToken, user, isLoading: false });
    } catch (error) {
      console.error('Login storage error:', error);
      // Still set in memory even if storage fails
      set({ token, refreshToken, user, isLoading: false });
    }
  },

  /**
   * Clear all credentials and reset state.
   */
  logout: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
    } catch (error) {
      console.error('Logout storage error:', error);
    }

    set({ token: null, refreshToken: null, user: null, isLoading: false });
  },

  /**
   * Update the access token (after refresh).
   */
  updateToken: async (token: string) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('Token update storage error:', error);
    }
    set({ token });
  },
}));
