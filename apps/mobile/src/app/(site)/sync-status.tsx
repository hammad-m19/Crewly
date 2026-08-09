import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';

export default function SyncStatusScreen() {
  const { pendingChangesCount, lastSyncAt, isSyncing, isOnline, lastError } = useSyncStore();
  const logout = useAuthStore((s) => s.logout);

  const handleManualSync = () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Changes will sync automatically when you reconnect.');
      return;
    }
    Alert.alert('Sync', 'Manual sync will be available when the sync engine is implemented in Phase 4.');
  };

  return (
    <View style={styles.container}>
      {/* Connection Status */}
      <View style={[styles.statusCard, isOnline ? styles.onlineCard : styles.offlineCard]}>
        <Text style={styles.statusEmoji}>{isOnline ? '🟢' : '🔴'}</Text>
        <Text style={styles.statusTitle}>{isOnline ? 'Connected' : 'Offline'}</Text>
        <Text style={styles.statusSubtitle}>
          {isOnline ? 'Data syncing normally' : 'Changes saved locally, will sync when connected'}
        </Text>
      </View>

      {/* Sync Details */}
      <View style={styles.detailsCard}>
        <DetailRow label="Pending Changes" value={String(pendingChangesCount)} />
        <DetailRow
          label="Last Sync"
          value={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
        />
        <DetailRow label="Sync Status" value={isSyncing ? 'Syncing...' : 'Idle'} />
        {lastError && <DetailRow label="Last Error" value={lastError} isError />}
      </View>

      {/* Manual Sync Button */}
      <TouchableOpacity
        style={[styles.syncButton, !isOnline && styles.syncButtonDisabled]}
        onPress={handleManualSync}
        disabled={isSyncing}
      >
        <Text style={styles.syncButtonText}>
          {isSyncing ? 'Syncing...' : '🔄 Sync Now'}
        </Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
          ]);
        }}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ label, value, isError }: { label: string; value: string; isError?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, isError && detailStyles.errorValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary, padding: spacing.lg },
  statusCard: {
    borderRadius: borderRadius.lg, padding: spacing['2xl'], alignItems: 'center',
    marginBottom: spacing['2xl'], ...shadows.sm,
  },
  onlineCard: { backgroundColor: colors.success.light },
  offlineCard: { backgroundColor: colors.danger.light },
  statusEmoji: { fontSize: 40, marginBottom: spacing.sm },
  statusTitle: { ...typography.heading3, color: colors.text.primary },
  statusSubtitle: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing.xs, textAlign: 'center' },
  detailsCard: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing['2xl'], ...shadows.sm,
  },
  syncButton: {
    backgroundColor: colors.primary[600], paddingVertical: spacing.lg,
    borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.lg,
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { ...typography.button, color: colors.text.inverse },
  logoutButton: {
    backgroundColor: colors.danger.light, paddingVertical: spacing.lg,
    borderRadius: borderRadius.md, alignItems: 'center',
  },
  logoutText: { ...typography.button, color: colors.danger.dark },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  label: { ...typography.body, color: colors.text.secondary },
  value: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  errorValue: { color: colors.danger.main },
});
