import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatMoneyCompact } from '../../lib/format';
import ProgressBar, { statusColor } from '../../components/ui/ProgressBar';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

interface ProjectSummary {
  projectId: string;
  name: string;
  location: string;
  status: string;
  teamCount: number;
  latestReportDate: string | null;
  budgetTotal: number;
  spent: { labor: number; materials: number; pettyCash: number; total: number };
  remaining: number;
  percentUsed: number | null;
  overBudget: boolean;
  flags: { working: number; idle: number; noShow: number; unverified: number };
}

interface DashboardData {
  summary: {
    activeProjects: number;
    totalProjects: number;
    teamsWorking: number;
    idleTeams: number;
    noShowTeams: number;
    pendingActions: number;
  };
  pendingActions: {
    unverifiedTasks: number;
    overdueOrders: number;
    missingReceipts: number;
    unreconciledFloats: number;
  };
  totals: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    percentUsed: number | null;
    projectsOverBudget: number;
  };
  projects: ProjectSummary[];
}

export default function OwnerDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await apiFetch<DashboardData>('/owner/dashboard');
    if (result.success && result.data) {
      setData(result.data);
      setLastFetched(Date.now());
      setError(null);
    } else {
      setError(result.error?.message || 'Could not load dashboard.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton rows={7} />
      </View>
    );
  }

  if (!data && error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={() => fetchDashboard(true)} />
      </View>
    );
  }

  const summary = data?.summary;
  const totals = data?.totals;
  const pending = data?.pendingActions;
  const projects = data?.projects ?? [];
  const activeProjects = projects.filter((p) => p.status === 'active');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchDashboard(true)}
          tintColor={colors.role.owner}
        />
      }
    >
      <View style={styles.welcomeSection}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.name || 'Owner'}</Text>
        {lastFetched && (
          <Text style={styles.syncInfo}>
            Updated {new Date(lastFetched).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {error && (
        <ErrorState
          title="Could not refresh"
          message={error}
          onRetry={() => fetchDashboard(true)}
          style={styles.inlineError}
        />
      )}

      <View style={styles.statsGrid}>
        <StatCard
          title="Active Projects"
          value={String(summary?.activeProjects ?? '—')}
          color={colors.primary[500]}
          emoji="🏗️"
        />
        <StatCard
          title="Teams Working"
          value={String(summary?.teamsWorking ?? '—')}
          color={colors.success.main}
          emoji="👷"
        />
        <StatCard
          title="Idle Teams"
          value={String(summary?.idleTeams ?? '—')}
          color={colors.warning.main}
          emoji="⚠️"
        />
        <StatCard
          title="Pending Actions"
          value={String(summary?.pendingActions ?? '—')}
          color={colors.danger.main}
          emoji="🔔"
        />
      </View>

      {/* Company-wide budget position */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget vs. Actual</Text>
        <View style={budgetStyles.headlineRow}>
          <View>
            <Text style={budgetStyles.spentValue}>{formatMoney(totals?.totalSpent ?? 0)}</Text>
            <Text style={budgetStyles.spentLabel}>
              spent of {formatMoney(totals?.totalBudget ?? 0)}
            </Text>
          </View>
          <View style={budgetStyles.percentBadge}>
            <Text
              style={[
                budgetStyles.percentText,
                { color: statusColor(totals?.percentUsed ?? 0) },
              ]}
            >
              {totals?.percentUsed !== null && totals?.percentUsed !== undefined
                ? `${totals.percentUsed}%`
                : '—'}
            </Text>
          </View>
        </View>
        <ProgressBar percent={totals?.percentUsed ?? 0} height={10} />
        <View style={budgetStyles.footerRow}>
          <Text style={budgetStyles.remaining}>
            {formatMoney(totals?.totalRemaining ?? 0)} remaining
          </Text>
          {!!totals?.projectsOverBudget && (
            <Text style={budgetStyles.overBudget}>
              {totals.projectsOverBudget} over budget
            </Text>
          )}
        </View>
      </View>

      {/* What needs the Owner's attention */}
      {!!pending && summary!.pendingActions > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Needs Attention</Text>
          <ActionRow
            emoji="✅"
            label="Completed tasks awaiting verification"
            count={pending.unverifiedTasks}
          />
          <ActionRow emoji="📦" label="Overdue material deliveries" count={pending.overdueOrders} />
          <ActionRow emoji="🧾" label="Purchases missing receipts" count={pending.missingReceipts} />
          <ActionRow
            emoji="💰"
            label="Petty cash floats to reconcile"
            count={pending.unreconciledFloats}
          />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projects Overview</Text>
        <TouchableOpacity onPress={() => router.push('/(owner)/projects')}>
          <Text style={styles.viewAll}>Manage →</Text>
        </TouchableOpacity>
      </View>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message="Create your first project to start tracking costs and crews."
          actionLabel="+ Create Project"
          onAction={() => router.push('/(owner)/projects')}
        />
      ) : (
        <>
          {activeProjects.map((project) => (
            <ProjectRow
              key={project.projectId}
              project={project}
              onPress={() =>
                router.push({
                  pathname: '/(owner)/project-detail',
                  params: { projectId: project.projectId },
                })
              }
            />
          ))}
          {projects.length > activeProjects.length && (
            <>
              <Text style={styles.subSectionTitle}>Not Active</Text>
              {projects
                .filter((p) => p.status !== 'active')
                .map((project) => (
                  <ProjectRow
                    key={project.projectId}
                    project={project}
                    onPress={() =>
                      router.push({
                        pathname: '/(owner)/project-detail',
                        params: { projectId: project.projectId },
                      })
                    }
                  />
                ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ProjectRow({
  project,
  onPress,
}: {
  project: ProjectSummary;
  onPress: () => void;
}) {
  const percent = project.percentUsed;

  return (
    <TouchableOpacity style={rowStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={rowStyles.header}>
        <View style={rowStyles.headerLeft}>
          <Text style={rowStyles.name}>{project.name}</Text>
          <Text style={rowStyles.location}>📍 {project.location}</Text>
        </View>
        <View style={rowStyles.headerRight}>
          {project.status !== 'active' && (
            <View style={rowStyles.statusChip}>
              <Text style={rowStyles.statusChipText}>
                {project.status === 'on_hold' ? 'On hold' : 'Completed'}
              </Text>
            </View>
          )}
          <Text style={rowStyles.chevron}>›</Text>
        </View>
      </View>

      <View style={rowStyles.moneyRow}>
        <Text style={rowStyles.spent}>{formatMoneyCompact(project.spent.total)}</Text>
        <Text style={rowStyles.budget}>
          of {formatMoneyCompact(project.budgetTotal)}
          {percent !== null ? ` · ${percent}%` : ' · no budget set'}
        </Text>
      </View>
      <ProgressBar percent={percent ?? 0} />

      <View style={rowStyles.flagRow}>
        <Text style={rowStyles.teamCount}>
          {project.teamCount} team{project.teamCount === 1 ? '' : 's'}
        </Text>
        {project.flags.working > 0 && (
          <MiniPill label={`${project.flags.working} working`} color={colors.success.main} />
        )}
        {project.flags.idle > 0 && (
          <MiniPill label={`${project.flags.idle} idle`} color={colors.warning.main} />
        )}
        {project.flags.noShow > 0 && (
          <MiniPill label={`${project.flags.noShow} no-show`} color={colors.danger.main} />
        )}
        {project.overBudget && <MiniPill label="over budget" color={colors.danger.main} />}
      </View>
    </TouchableOpacity>
  );
}

function ActionRow({
  emoji,
  label,
  count,
}: {
  emoji: string;
  label: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <View style={actionStyles.row}>
      <Text style={actionStyles.emoji}>{emoji}</Text>
      <Text style={actionStyles.label}>{label}</Text>
      <View style={actionStyles.countBadge}>
        <Text style={actionStyles.countText}>{count}</Text>
      </View>
    </View>
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

function MiniPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[miniPillStyles.container, { backgroundColor: color + '18' }]}>
      <Text style={[miniPillStyles.text, { color }]}>{label}</Text>
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
  inlineError: {
    flex: 0,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  subSectionTitle: {
    ...typography.label,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  viewAll: {
    ...typography.label,
    color: colors.primary[500],
  },
});

const budgetStyles = StyleSheet.create({
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  spentValue: { ...typography.heading2, color: colors.text.primary },
  spentLabel: { ...typography.bodySmall, color: colors.text.tertiary, marginTop: spacing.xxs },
  percentBadge: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  percentText: { ...typography.heading4 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  remaining: { ...typography.bodySmall, color: colors.text.secondary },
  overBudget: { ...typography.bodySmall, color: colors.danger.main, fontWeight: '600' },
});

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  emoji: { fontSize: 18, marginRight: spacing.md },
  label: { ...typography.bodySmall, color: colors.text.secondary, flex: 1 },
  countBadge: {
    backgroundColor: colors.danger.light,
    borderRadius: borderRadius.full,
    minWidth: 26,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  countText: { ...typography.caption, color: colors.danger.dark, fontWeight: '700' },
});

const rowStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.heading4, color: colors.text.primary },
  location: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  statusChip: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  statusChipText: { ...typography.caption, color: colors.text.tertiary },
  chevron: { ...typography.heading3, color: colors.neutral[400] },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  spent: { ...typography.heading4, color: colors.text.primary },
  budget: { ...typography.caption, color: colors.text.tertiary },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  teamCount: { ...typography.caption, color: colors.text.tertiary, marginRight: spacing.xs },
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

const miniPillStyles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  text: { ...typography.caption, fontWeight: '600' },
});
