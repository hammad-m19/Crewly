import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useSyncStore } from '../../store/syncStore';
import Button from '../../components/ui/Button';
import { performSync } from '../../lib/sync';
import StatusChip from '../../components/ui/StatusChip';

export default function SyncStatusScreen() {
  const { isOnline, isSyncing, lastSyncAt, pendingChangesCount, lastError } = useSyncStore();

  const handleManualSync = () => {
    performSync();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success.main : colors.danger.main }]} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        <Text style={styles.lastSync}>
          Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Never'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Local Changes</Text>
          <StatusChip 
            status={pendingChangesCount > 0 ? 'pending' : 'synced'} 
            label={pendingChangesCount > 0 ? `${pendingChangesCount} Pending` : 'Up to date'} 
          />
        </View>
        
        <Text style={styles.cardDesc}>
          {pendingChangesCount > 0 
            ? 'You have changes saved locally that need to be synced with the server.' 
            : 'All your changes are securely backed up on the server.'}
        </Text>

        {lastError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Last sync failed</Text>
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}

        <Button
          title={isSyncing ? 'Syncing...' : 'Sync Now'}
          onPress={handleManualSync}
          loading={isSyncing}
          disabled={isSyncing || !isOnline}
          icon="🔄"
          style={styles.syncButton}
        />
      </View>

      {!isOnline && (
        <View style={styles.infoBox}>
          <Text style={styles.infoEmoji}>💡</Text>
          <Text style={styles.infoText}>
            You can continue working normally while offline. Your changes will be saved to this device and automatically synced when you regain internet connection.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  statusText: { ...typography.label, color: colors.text.primary },
  lastSync: { ...typography.caption, color: colors.text.tertiary },
  
  card: {
    backgroundColor: colors.background.card,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.heading3, color: colors.text.primary },
  cardDesc: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.xl },
  syncButton: { marginTop: spacing.md },
  
  errorBox: {
    backgroundColor: colors.danger.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger.main,
  },
  errorTitle: { ...typography.label, color: colors.danger.dark, marginBottom: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger.dark },

  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.info.light,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  infoEmoji: { fontSize: 24, marginRight: spacing.md },
  infoText: { flex: 1, ...typography.bodySmall, color: colors.info.dark },
});
