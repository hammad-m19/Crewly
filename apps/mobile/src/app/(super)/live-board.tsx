import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useSyncStore } from '../../store/syncStore';

export default function LiveBoard() {
  const { isOnline, lastSyncAt } = useSyncStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 Offline — showing last synced data
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title}>Cross-Site Overview</Text>
        {lastSyncAt && (
          <Text style={styles.syncText}>
            Updated: {new Date(lastSyncAt).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Status summary bar */}
      <View style={styles.statusBar}>
        <StatusPill label="Active" count="—" color={colors.success.main} />
        <StatusPill label="Idle" count="—" color={colors.warning.main} />
        <StatusPill label="No-Show" count="—" color={colors.danger.main} />
        <StatusPill label="Blocked" count="—" color={colors.info.main} />
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text style={styles.emptyTitle}>Live Board</Text>
        <Text style={styles.emptySubtitle}>
          All sites, teams, and status flags will appear here.
          {'\n'}Requires connectivity to aggregate cross-site data.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatusPill({ label, count, color }: { label: string; count: string; color: string }) {
  return (
    <View style={[pillStyles.container, { backgroundColor: color + '15' }]}>
      <Text style={[pillStyles.count, { color }]}>{count}</Text>
      <Text style={[pillStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  offlineBanner: {
    backgroundColor: colors.warning.light, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.lg,
  },
  offlineBannerText: { ...typography.bodySmall, color: colors.warning.dark, textAlign: 'center' },
  header: { marginBottom: spacing.lg },
  title: { ...typography.heading3, color: colors.text.primary },
  syncText: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  statusBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing['2xl'] },
  emptyState: {
    alignItems: 'center', paddingVertical: spacing['4xl'],
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg, ...shadows.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.bodySmall, color: colors.text.tertiary, textAlign: 'center', paddingHorizontal: spacing.lg },
});

const pillStyles = StyleSheet.create({
  container: { flex: 1, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  count: { ...typography.heading3 },
  label: { ...typography.caption, marginTop: spacing.xxs },
});
