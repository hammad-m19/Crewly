import { synchronize } from '@nozbe/watermelondb/sync';
import database from '../db';
import { apiFetch } from './api';
import { useSyncStore } from '../store/syncStore';
import { SyncPullResponse } from '@crewly/shared';
import NetInfo from '@react-native-community/netinfo';

/**
 * WatermelonDB sync — implements the pull/push protocol.
 *
 * Called automatically when the app comes online,
 * and manually from the Sync Status screen.
 *
 * Offline behavior: sync is skipped entirely when offline.
 * Changes accumulate in WatermelonDB's local change tracking
 * and are pushed on the next successful sync.
 */
export async function performSync(): Promise<void> {
  const syncStore = useSyncStore.getState();

  // Check connectivity first
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    syncStore.setOnline(false);
    return;
  }

  syncStore.setOnline(true);
  syncStore.setSyncing(true);

  try {
    await synchronize({
      database,

      pullChanges: async ({ lastPulledAt }) => {
        const timestamp = lastPulledAt || 0;
        const result = await apiFetch<SyncPullResponse>(
          `/sync/pull?last_pulled_at=${timestamp}`
        );

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Sync pull failed');
        }

        return {
          changes: result.data.changes,
          timestamp: result.data.timestamp,
        };
      },

      pushChanges: async ({ changes, lastPulledAt }) => {
        const result = await apiFetch('/sync/push', {
          method: 'POST',
          body: { changes, lastPulledAt },
        });

        if (!result.success) {
          throw new Error(result.error?.message || 'Sync push failed');
        }
      },

      // Allow sending raw record data (no migration needed at this point)
      sendCreatedAsUpdated: false,
    });

    syncStore.setSyncComplete(Date.now());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    console.error('Sync error:', message);
    syncStore.setSyncError(message);
  }
}

/**
 * Set up automatic sync on network connectivity change.
 * Call this once in the root layout.
 */
export function setupAutoSync(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const syncStore = useSyncStore.getState();
    const wasOffline = !syncStore.isOnline;

    syncStore.setOnline(!!state.isConnected);

    // Auto-sync when reconnecting
    if (wasOffline && state.isConnected) {
      console.log('📡 Back online — triggering auto-sync');
      performSync();
    }
  });

  return unsubscribe;
}
