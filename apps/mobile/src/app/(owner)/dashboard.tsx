import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';

export default function OwnerDashboard() {
  const user = useAuthStore((s) => s.user);
  const { isOnline, lastSyncAt } = useSyncStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 You're offline. Data may not be up to date.
          </Text>
        </View>
      )}

      {/* Welcome Header */}
      <View style={styles.welcomeSection}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.name || 'Owner'}</Text>
        {lastSyncAt && (
          <Text style={styles.syncInfo}>
            Last synced: {new Date(lastSyncAt).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Active Projects"
          value="—"
          color={colors.primary[500]}
          emoji="🏗️"
        />
        <StatCard
          title="Teams Working"
          value="—"
          color={colors.success.main}
          emoji="👷"
        />
        <StatCard
          title="Idle Teams"
          value="—"
          color={colors.warning.main}
          emoji="⚠️"
        />
        <StatCard
          title="Pending Actions"
          value="—"
          color={colors.danger.main}
          emoji="🔔"
        />
      </View>

      {/* Projects Overview */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projects Overview</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View All →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text style={styles.emptyTitle}>No projects yet</Text>
        <Text style={styles.emptySubtitle}>
          Create your first project to start tracking
        </Text>
      </View>
    </ScrollView>
  );
}

function StatCard({
  title,
  value,
  color,
  emoji,
}: {
  title: string;
  value: string;
  color: string;
  emoji: string;
}) {
  return (
    <View style={[statStyles.card, { borderLeftColor: color }]}>
      <Text style={statStyles.emoji}>{emoji}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  offlineBanner: {
    backgroundColor: colors.warning.light,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  offlineBannerText: {
    ...typography.bodySmall,
    color: colors.warning.dark,
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: spacing['2xl'],
  },
  greeting: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  userName: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  syncInfo: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  viewAll: {
    ...typography.label,
    color: colors.primary[500],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  emoji: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  title: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
});
