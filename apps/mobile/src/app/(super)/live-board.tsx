import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, AppState } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useSyncStore } from '../../store/syncStore';
import { apiFetch } from '../../lib/api';

interface TeamStatus {
  assignmentId: string;
  teamId: string;
  teamName: string;
  trade: string;
  paymentType: string;
  assignedDate: string;
  latestStatus: {
    attendanceStatus: string;
    headcountPresent: number;
    idleReason: string | null;
    taskCompleted: boolean;
    taskWorkedOn: string;
  } | null;
}

interface ProjectOverview {
  projectId: string;
  projectName: string;
  projectLocation: string;
  teams: TeamStatus[];
  flags: { active: number; idle: number; noShow: number; blocked: number; unverified: number };
  latestReportDate: string | null;
  totalAssignedTeams: number;
}

interface OverviewData {
  projects: ProjectOverview[];
  summary: { totalProjects: number; totalActiveTeams: number; totalIdle: number; totalNoShow: number; totalBlocked: number };
}

const AUTO_REFRESH_INTERVAL = 30_000; // 30 seconds

export default function LiveBoard() {
  const { isOnline, lastSyncAt } = useSyncStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const fetchOverview = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const result = await apiFetch<OverviewData>('/coordination/overview');
      if (result.success && result.data) {
        setData(result.data);
        setLastFetched(Date.now());
      }
    } catch (e) {
      console.error('Failed to fetch overview:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on every screen focus (not just mount)
  useFocusEffect(
    useCallback(() => {
      fetchOverview();

      // Set up periodic auto-refresh
      intervalRef.current = setInterval(() => {
        fetchOverview();
      }, AUTO_REFRESH_INTERVAL);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [fetchOverview])
  );

  // Pause/resume auto-refresh when app goes to background/foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came back to foreground — refresh immediately and restart interval
        fetchOverview();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => fetchOverview(), AUTO_REFRESH_INTERVAL);
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background — stop interval
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [fetchOverview]);

  const summary = data?.summary;
  const projects = data?.projects || [];

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading cross-site data…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchOverview(true)}
          tintColor={colors.role.super_supervisor}
        />
      }
    >
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 Offline — showing last synced data
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title}>Cross-Site Overview</Text>
        {lastFetched && (
          <Text style={styles.syncText}>
            Updated: {new Date(lastFetched).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Status summary bar */}
      <View style={styles.statusBar}>
        <StatusPill label="Active" count={String(summary?.totalActiveTeams ?? '—')} color={colors.success.main} />
        <StatusPill label="Idle" count={String(summary?.totalIdle ?? '—')} color={colors.warning.main} />
        <StatusPill label="No-Show" count={String(summary?.totalNoShow ?? '—')} color={colors.danger.main} />
        <StatusPill label="Blocked" count={String(summary?.totalBlocked ?? '—')} color={colors.info.main} />
      </View>

      {/* Project cards */}
      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No Active Projects</Text>
          <Text style={styles.emptySubtitle}>
            Active projects with assigned teams will appear here.
          </Text>
        </View>
      ) : (
        projects.map(project => (
          <ProjectCard
            key={project.projectId}
            project={project}
            expanded={expandedProject === project.projectId}
            onToggle={() =>
              setExpandedProject(
                expandedProject === project.projectId ? null : project.projectId
              )
            }
          />
        ))
      )}
    </ScrollView>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggle,
}: {
  project: ProjectOverview;
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalFlags = project.flags.idle + project.flags.noShow + project.flags.blocked;

  return (
    <View style={cardStyles.container}>
      <TouchableOpacity style={cardStyles.header} onPress={onToggle} activeOpacity={0.7}>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.projectName}>{project.projectName}</Text>
          <Text style={cardStyles.projectLocation}>📍 {project.projectLocation}</Text>
        </View>
        <View style={cardStyles.headerRight}>
          {totalFlags > 0 && (
            <View style={cardStyles.flagBadge}>
              <Text style={cardStyles.flagBadgeText}>⚠ {totalFlags}</Text>
            </View>
          )}
          <Text style={cardStyles.teamCount}>
            {project.totalAssignedTeams} team{project.totalAssignedTeams !== 1 ? 's' : ''}
          </Text>
          <Text style={cardStyles.expandArrow}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Flag pills */}
      <View style={cardStyles.flagRow}>
        {project.flags.active > 0 && (
          <MiniPill label={`${project.flags.active} active`} color={colors.success.main} />
        )}
        {project.flags.idle > 0 && (
          <MiniPill label={`${project.flags.idle} idle`} color={colors.warning.main} />
        )}
        {project.flags.noShow > 0 && (
          <MiniPill label={`${project.flags.noShow} no-show`} color={colors.danger.main} />
        )}
        {project.flags.blocked > 0 && (
          <MiniPill label={`${project.flags.blocked} blocked`} color={colors.info.main} />
        )}
        {project.flags.unverified > 0 && (
          <MiniPill label={`${project.flags.unverified} unverified`} color={colors.role.super_supervisor} />
        )}
      </View>

      {/* Latest report date */}
      {project.latestReportDate && (
        <Text style={cardStyles.reportDate}>
          Last report: {project.latestReportDate}
        </Text>
      )}

      {/* Expanded: team details */}
      {expanded && (
        <View style={cardStyles.teamList}>
          {project.teams.length === 0 ? (
            <Text style={cardStyles.noTeams}>No teams assigned</Text>
          ) : (
            project.teams.map(team => (
              <TeamRow key={team.assignmentId} team={team} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

function TeamRow({ team }: { team: TeamStatus }) {
  const status = team.latestStatus;
  const statusColor = !status
    ? colors.neutral[400]
    : status.attendanceStatus === 'no_show'
    ? colors.danger.main
    : status.idleReason
    ? colors.warning.main
    : colors.success.main;

  const statusLabel = !status
    ? 'No report'
    : status.attendanceStatus === 'no_show'
    ? '🚫 No-show'
    : status.idleReason
    ? `⚠️ Idle: ${status.idleReason.replace(/_/g, ' ')}`
    : `✅ Working (${status.headcountPresent} pax)`;

  return (
    <View style={teamStyles.row}>
      <View style={[teamStyles.indicator, { backgroundColor: statusColor }]} />
      <View style={teamStyles.info}>
        <Text style={teamStyles.name}>{team.teamName}</Text>
        <Text style={teamStyles.trade}>{team.trade.replace(/_/g, ' ')}</Text>
      </View>
      <View style={teamStyles.statusArea}>
        <Text style={[teamStyles.status, { color: statusColor }]}>{statusLabel}</Text>
        {status?.taskCompleted && (
          <Text style={teamStyles.taskBadge}>✅ Task done</Text>
        )}
        {status?.taskWorkedOn ? (
          <Text style={teamStyles.task} numberOfLines={1}>
            {status.taskWorkedOn}
          </Text>
        ) : null}
      </View>
    </View>
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

function MiniPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[miniPillStyles.container, { backgroundColor: color + '18' }]}>
      <Text style={[miniPillStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.tertiary },
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

const miniPillStyles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  text: { ...typography.caption, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    marginBottom: spacing.lg, ...shadows.sm, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  projectName: { ...typography.heading4, color: colors.text.primary },
  projectLocation: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  flagBadge: {
    backgroundColor: colors.danger.light, borderRadius: borderRadius.full,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
  },
  flagBadgeText: { ...typography.caption, color: colors.danger.dark, fontWeight: '700' },
  teamCount: { ...typography.caption, color: colors.text.tertiary },
  expandArrow: { ...typography.caption, color: colors.neutral[400], marginLeft: spacing.xs },
  flagRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  reportDate: {
    ...typography.caption, color: colors.text.tertiary,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  teamList: {
    borderTopWidth: 1, borderTopColor: colors.neutral[100],
    paddingTop: spacing.sm,
  },
  noTeams: {
    ...typography.bodySmall, color: colors.text.tertiary,
    textAlign: 'center', padding: spacing.lg,
  },
});

const teamStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[50],
  },
  indicator: {
    width: 4, height: 36, borderRadius: 2, marginRight: spacing.md,
  },
  info: { width: 100 },
  name: { ...typography.label, color: colors.text.primary },
  trade: { ...typography.caption, color: colors.text.tertiary, textTransform: 'capitalize' },
  statusArea: { flex: 1, alignItems: 'flex-end' },
  status: { ...typography.bodySmall, fontWeight: '600' },
  taskBadge: { ...typography.caption, color: colors.success.main, marginTop: spacing.xxs },
  task: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs, maxWidth: 180 },
});
