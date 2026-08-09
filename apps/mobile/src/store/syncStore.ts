import { create } from 'zustand';

interface SyncState {
  /** Number of records pending upload */
  pendingChangesCount: number;
  /** Timestamp of last successful sync */
  lastSyncAt: number | null;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Whether the device has network connectivity */
  isOnline: boolean;
  /** Last sync error message */
  lastError: string | null;

  // Actions
  setSyncing: (syncing: boolean) => void;
  setSyncComplete: (timestamp: number) => void;
  setSyncError: (error: string) => void;
  setPendingCount: (count: number) => void;
  setOnline: (online: boolean) => void;
}

/**
 * Sync state store — tracks offline/online status and sync progress.
 * Used by the UI to show sync indicators, offline banners, etc.
 */
export const useSyncStore = create<SyncState>((set) => ({
  pendingChangesCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  isOnline: true, // Assume online until NetInfo says otherwise
  lastError: null,

  setSyncing: (isSyncing) => set({ isSyncing, lastError: null }),
  setSyncComplete: (timestamp) =>
    set({ lastSyncAt: timestamp, isSyncing: false, lastError: null }),
  setSyncError: (error) => set({ lastError: error, isSyncing: false }),
  setPendingCount: (count) => set({ pendingChangesCount: count }),
  setOnline: (isOnline) => set({ isOnline }),
}));
