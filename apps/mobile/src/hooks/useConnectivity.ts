import { useSyncStore } from '../store/syncStore';

/**
 * Connectivity + last-sync helpers for offline UX.
 *
 * Source of truth is `syncStore` (updated by NetInfo via `setupAutoSync` /
 * `performSync` in `lib/sync.ts`) — do not open a second NetInfo listener here.
 */
export function useConnectivity() {
  const isOnline = useSyncStore((s) => s.isOnline);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const isSyncing = useSyncStore((s) => s.isSyncing);

  const lastSyncedLabel = formatLastSynced(lastSyncAt);

  return {
    isOnline,
    isOffline: !isOnline,
    lastSyncAt,
    isSyncing,
    lastSyncedLabel,
  };
}

function formatLastSynced(lastSyncAt: number | null): string {
  if (!lastSyncAt) return 'Not synced yet';

  const synced = new Date(lastSyncAt);
  const now = new Date();
  const sameDay =
    synced.getFullYear() === now.getFullYear() &&
    synced.getMonth() === now.getMonth() &&
    synced.getDate() === now.getDate();

  if (sameDay) {
    return `Last synced ${synced.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  return `Last synced ${synced.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}
