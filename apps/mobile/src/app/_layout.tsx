import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import database from '../db';
import { setupAutoSync, performSync } from '../lib/sync';
import { photoSyncQueue } from '../lib/photoSync';
import { useConnectivity } from '../hooks/useConnectivity';
import { registerForPushNotifications } from '../lib/pushNotifications';

/**
 * Root layout — handles:
 * 1. WatermelonDB provider (wraps entire app)
 * 2. Auth state initialization from SecureStore
 * 3. Auth-based navigation guard (redirect to login or dashboard)
 * 4. Auto-sync on connectivity change
 * 5. Global offline banner
 */
export default function RootLayout() {
  const { user, isInitialized, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize auth state on app launch
  useEffect(() => {
    initialize();
  }, []);

  // Setup auto-sync once auth is ready; restore any pending photo uploads
  useEffect(() => {
    if (!isInitialized || !user) return;

    // Start listening for connectivity changes
    const unsubscribe = setupAutoSync();

    // Initial sync after login
    performSync();

    // Resume photo uploads that survived an app restart
    photoSyncQueue.hydrate();

    // Request push permission + register FCM token (best-effort)
    void registerForPushNotifications();

    return unsubscribe;
  }, [isInitialized, user]);

  // Navigation guard — redirect based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
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
      <View style={styles.root}>
        <OfflineBanner />
        <Slot />
        <StatusBar style="dark" />
      </View>
    </DatabaseProvider>
  );
}

function OfflineBanner() {
  const { isOffline, lastSyncedLabel } = useConnectivity();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View style={[styles.offlineBanner, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
      <Text style={styles.offlineTitle}>You're offline — changes will sync later</Text>
      <Text style={styles.offlineSubtitle}>{lastSyncedLabel}</Text>
    </View>
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
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  offlineBanner: {
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  offlineTitle: {
    ...typography.bodySmall,
    color: colors.text.inverse,
    fontWeight: '600',
    textAlign: 'center',
  },
  offlineSubtitle: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
});
