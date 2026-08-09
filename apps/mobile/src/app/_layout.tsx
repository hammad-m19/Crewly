import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import DatabaseProvider from '@nozbe/watermelondb/DatabaseProvider';
import database from '../db';

/**
 * Root layout — handles:
 * 1. WatermelonDB provider (wraps entire app)
 * 2. Auth state initialization from SecureStore
 * 3. Auth-based navigation guard (redirect to login or dashboard)
 */
export default function RootLayout() {
  const { user, isInitialized, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize auth state on app launch
  useEffect(() => {
    initialize();
  }, []);

  // Navigation guard — redirect based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not logged in, redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Logged in, redirect to role-based dashboard
      const roleRoute = getRoleRoute(user.role);
      router.replace(roleRoute as any);
    }
  }, [user, isInitialized, segments]);

  // Show loading screen while initializing auth
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <DatabaseProvider database={database}>
      <Slot />
      <StatusBar style="dark" />
    </DatabaseProvider>
  );
}

/**
 * Map user role to their dashboard route.
 */
function getRoleRoute(role: string): string {
  switch (role) {
    case 'owner':
      return '/(owner)/dashboard';
    case 'super_supervisor':
      return '/(super)/live-board';
    case 'site_supervisor':
      return '/(site)/daily-report';
    case 'accountant':
      return '/(accountant)/payment-queue';
    default:
      return '/(auth)/login';
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
});
