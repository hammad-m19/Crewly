import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatMoneyCompact, humanize } from '../../lib/format';
import ProgressBar from '../../components/ui/ProgressBar';

interface CategoryBreakdown {
  budgeted: number;
  spent: number;
}

interface ProjectReport {
  projectId: string;
  name: string;
  location: string;
  status: string;
  budgetTotal: number;
  spentTotal: number;
  remaining: number;
  percentUsed: number | null;
  overBudget: boolean;
  breakdown: {
    labor: CategoryBreakdown;
    materials: CategoryBreakdown;
    pettyCash: CategoryBreakdown;
  };
}

interface CostReportsData {
  totals: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    percentUsed: number | null;
    totalLabor: number;
    totalMaterials: number;
    totalPettyCash: number;
  };
  projects: ProjectReport[];
}

export default function CostReports() {
  const [data, setData] = useState<CostReportsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await apiFetch<CostReportsData>('/accountant/cost-reports');
    if (result.success && result.data) {
      setData(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error?.message || 'Could not load cost reports.');
    }
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports])
  );

  if (!data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={loadError ? styles.errorText : styles.loadingText}>
          {loadError || 'Loading cost reports…'}
        </Text>
      </View>
    );
  }

  const { totals } = data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchReports(true)} />
      }
    >
      <View style={summaryStyles.card}>
        <Text style={summaryStyles.title}>All projects</Text>
        <View style={summaryStyles.figuresRow}>
          <SummaryFigure label="Budget" value={formatMoneyCompact(totals.totalBudget)} />
          <SummaryFigure label="Spent" value={formatMoneyCompact(totals.totalSpent)} />
          <SummaryFigure
            label="Remaining"
            value={formatMoneyCompact(totals.totalRemaining)}
            highlight={totals.totalRemaining < 0}
          />
        </View>
        <ProgressBar percent={totals.percentUsed} />
        <View style={summaryStyles.splitRow}>
          <SplitItem label="Labor" value={totals.totalLabor} color={colors.role.accountant} />
          <SplitItem label="Materials" value={totals.totalMaterials} color={colors.info.main} />
          <SplitItem label="Petty cash" value={totals.totalPettyCash} color={colors.accent[700]} />
        </View>
      </View>

      {data.projects.length === 0 && (
        <Text style={styles.emptyText}>No projects yet.</Text>
      )}

      {data.projects.map((project) => (
        <View key={project.projectId} style={cardStyles.card}>
          <View style={cardStyles.topRow}>
            <View style={cardStyles.titleArea}>
              <Text style={cardStyles.name}>{project.name}</Text>
              <Text style={cardStyles.meta}>
                {project.location} · {humanize(project.status)}
              </Text>
            </View>
            {project.overBudget && (
              <View style={cardStyles.overPill}>
                <Text style={cardStyles.overPillText}>Over budget</Text>
              </View>
            )}
          </View>

          <View style={cardStyles.totalsRow}>
            <Text style={cardStyles.spent}>{formatMoney(project.spentTotal)}</Text>
            <Text style={cardStyles.ofBudget}>
              of {formatMoney(project.budgetTotal)}
              {project.percentUsed !== null ? ` (${project.percentUsed}%)` : ''}
            </Text>
          </View>
          <ProgressBar percent={project.percentUsed} />

          <View style={cardStyles.breakdown}>
            <BreakdownRow label="Labor" data={project.breakdown.labor} />
            <BreakdownRow label="Materials" data={project.breakdown.materials} />
            <BreakdownRow label="Petty cash (overhead)" data={project.breakdown.pettyCash} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function SummaryFigure({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={summaryStyles.figure}>
      <Text style={summaryStyles.figureLabel}>{label}</Text>
      <Text style={[summaryStyles.figureValue, highlight && { color: colors.danger.main }]}>
        {value}
      </Text>
    </View>
  );
}

function SplitItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={summaryStyles.splitItem}>
      <View style={[summaryStyles.splitDot, { backgroundColor: color }]} />
      <Text style={summaryStyles.splitLabel}>{label}</Text>
      <Text style={summaryStyles.splitValue}>{formatMoneyCompact(value)}</Text>
    </View>
  );
}

function BreakdownRow({ label, data }: { label: string; data: CategoryBreakdown }) {
  const percent = data.budgeted > 0 ? Math.round((data.spent / data.budgeted) * 100) : null;
  return (
    <View style={breakdownStyles.row}>
      <View style={breakdownStyles.labelRow}>
        <Text style={breakdownStyles.label}>{label}</Text>
        <Text style={breakdownStyles.values}>
          {formatMoneyCompact(data.spent)}
          {data.budgeted > 0 ? ` / ${formatMoneyCompact(data.budgeted)}` : ''}
        </Text>
      </View>
      <ProgressBar percent={percent} height={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  errorText: { ...typography.body, color: colors.danger.dark, textAlign: 'center' },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
});

const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  title: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.md },
  figuresRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  figure: { flex: 1 },
  figureLabel: { ...typography.caption, color: colors.text.tertiary },
  figureValue: { ...typography.body, color: colors.text.primary, fontWeight: '700', marginTop: 1 },
  splitRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  splitItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitLabel: { ...typography.caption, color: colors.text.tertiary },
  splitValue: { ...typography.caption, color: colors.text.primary, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleArea: { flex: 1, paddingRight: spacing.md },
  name: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  overPill: {
    backgroundColor: colors.danger.light,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  overPillText: { ...typography.caption, color: colors.danger.dark, fontWeight: '600' },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  spent: { ...typography.heading4, color: colors.text.primary },
  ofBudget: { ...typography.caption, color: colors.text.tertiary },
  breakdown: { marginTop: spacing.md, gap: spacing.md },
});

const breakdownStyles = StyleSheet.create({
  row: {},
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: { ...typography.caption, color: colors.text.secondary },
  values: { ...typography.caption, color: colors.text.tertiary },
});
