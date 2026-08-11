import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { PaymentType } from '@crewly/shared';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatDate, humanize } from '../../lib/format';
import ProgressBar, { statusColor } from '../../components/ui/ProgressBar';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface CategoryLine {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentUsed: number | null;
  tracked: boolean;
}

interface TradeLine {
  trade: string;
  budgeted: number;
  spent: number;
}

interface Transaction {
  id: string;
  kind: 'payment' | 'purchase';
  label: string;
  amount: number;
  date: string;
  notes: string;
  flagged: boolean;
}

interface BudgetChange {
  previousTotal: number;
  newTotal: number;
  changedBy: string;
  changedAt: string;
  reason: string;
}

interface CostBreakdown {
  project: {
    projectId: string;
    name: string;
    location: string;
    status: string;
    startDate: string;
    expectedEndDate: string;
    siteSupervisorName: string | null;
  };
  totals: {
    budgetTotal: number;
    spentTotal: number;
    remaining: number;
    percentUsed: number | null;
    labor: number;
    materials: number;
    pettyCashSpent: number;
    pettyCashIssued: number;
    pettyCashOnHand: number;
  };
  categories: CategoryLine[];
  trades: TradeLine[];
  transactions: Transaction[];
  budgetHistory: BudgetChange[];
  activeTeamCount: number;
}

interface Assignment {
  _id: string;
  paymentType: string;
  assignedDate: string;
  agreedTotal?: number | null;
  teamId: { _id: string; name: string; trade: string } | string;
}

interface Team {
  _id: string;
  name: string;
  trade: string;
  defaultPaymentType: string;
}

const PAYMENT_TYPES = Object.values(PaymentType);

export default function ProjectDetail() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const navigation = useNavigation();
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<string>(PaymentType.DAILY_WAGE);
  const [agreedTotal, setAgreedTotal] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!projectId) return;
      if (isRefresh) setRefreshing(true);

      const [breakdownRes, assignmentsRes, teamsRes] = await Promise.all([
        apiFetch<CostBreakdown>(`/owner/projects/${projectId}/cost-breakdown`),
        apiFetch<Assignment[]>(`/teams/assignments?projectId=${projectId}`),
        apiFetch<Team[]>('/teams'),
      ]);

      if (breakdownRes.success && breakdownRes.data) {
        setData(breakdownRes.data);
        setError(null);
        navigation.setOptions({ title: breakdownRes.data.project.name });
      } else {
        setError(breakdownRes.error?.message || 'Could not load cost breakdown.');
      }
      if (assignmentsRes.success && assignmentsRes.data) setAssignments(assignmentsRes.data);
      if (teamsRes.success && teamsRes.data) setTeams(teamsRes.data);

      setLoading(false);
      setRefreshing(false);
    },
    [projectId, navigation]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const assignedTeamIds = new Set(
    assignments.map((a) => (typeof a.teamId === 'string' ? a.teamId : a.teamId?._id))
  );
  const availableTeams = teams.filter((team) => !assignedTeamIds.has(team._id));

  const handleAssign = async () => {
    if (!selectedTeamId) return;

    if (paymentType === PaymentType.LUMP_SUM && !Number(agreedTotal)) {
      Alert.alert('Agreed total required', 'Lump-sum assignments need an agreed total.');
      return;
    }

    setAssigning(true);
    const result = await apiFetch('/teams/assign', {
      method: 'POST',
      body: {
        projectId,
        teamId: selectedTeamId,
        paymentType,
        ...(paymentType === PaymentType.LUMP_SUM ? { agreedTotal: Number(agreedTotal) } : {}),
      },
    });
    setAssigning(false);

    if (result.success) {
      setAssignModalVisible(false);
      setSelectedTeamId(null);
      setAgreedTotal('');
      fetchData();
    } else {
      Alert.alert('Could not assign team', result.error?.message || 'Please try again.');
    }
  };

  const handleUnassign = (assignment: Assignment) => {
    const teamName = typeof assignment.teamId === 'string' ? 'this team' : assignment.teamId.name;
    Alert.alert('Remove team', `Remove ${teamName} from this site?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await apiFetch('/teams/unassign', {
            method: 'POST',
            body: { assignmentId: assignment._id },
          });
          if (result.success) fetchData();
          else Alert.alert('Error', result.error?.message || 'Could not remove the team.');
        },
      },
    ]);
  };

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading cost breakdown…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error || 'Project not found.'}</Text>
      </View>
    );
  }

  const { project, totals, categories, trades, transactions, budgetHistory } = data;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.role.owner}
          />
        }
      >
        {/* Project header */}
        <View style={styles.card}>
          <Text style={styles.projectName}>{project.name}</Text>
          <Text style={styles.projectMeta}>📍 {project.location}</Text>
          <Text style={styles.projectMeta}>
            🗓 {formatDate(project.startDate)} → {formatDate(project.expectedEndDate)}
          </Text>
          <Text style={styles.projectMeta}>
            👷 Supervisor: {project.siteSupervisorName || 'Unassigned'}
          </Text>
          <Text style={styles.projectMeta}>🚦 Status: {humanize(project.status)}</Text>
        </View>

        {/* Headline budget position */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Spend</Text>
          <View style={styles.headlineRow}>
            <Text style={styles.headlineValue}>{formatMoney(totals.spentTotal)}</Text>
            <Text style={[styles.headlinePercent, { color: statusColor(totals.percentUsed ?? 0) }]}>
              {totals.percentUsed !== null ? `${totals.percentUsed}%` : '—'}
            </Text>
          </View>
          <Text style={styles.headlineSub}>of {formatMoney(totals.budgetTotal)} budgeted</Text>
          <ProgressBar percent={totals.percentUsed ?? 0} height={10} />
          <Text
            style={[
              styles.remainingText,
              totals.remaining < 0 && { color: colors.danger.main, fontWeight: '600' },
            ]}
          >
            {totals.remaining < 0
              ? `${formatMoney(Math.abs(totals.remaining))} over budget`
              : `${formatMoney(totals.remaining)} remaining`}
          </Text>

          <View style={styles.splitRow}>
            <SplitCell label="Labor" value={totals.labor} color={colors.primary[500]} />
            <SplitCell label="Materials" value={totals.materials} color={colors.accent[700]} />
            <SplitCell label="Petty cash" value={totals.pettyCashSpent} color={colors.info.main} />
          </View>
          <Text style={styles.footnote}>
            Petty cash on hand: {formatMoney(totals.pettyCashOnHand)} of{' '}
            {formatMoney(totals.pettyCashIssued)} issued
          </Text>
        </View>

        {/* Budget vs actual by category */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Category</Text>
          {categories.every((c) => c.budgeted === 0 && c.spent === 0) ? (
            <Text style={styles.emptyText}>No budget set for this project yet.</Text>
          ) : (
            categories.map((line) => (
              <View key={line.category} style={lineStyles.row}>
                <View style={lineStyles.header}>
                  <Text style={lineStyles.label}>{humanize(line.category)}</Text>
                  <Text style={lineStyles.amounts}>
                    {formatMoney(line.spent)}
                    <Text style={lineStyles.budgeted}> / {formatMoney(line.budgeted)}</Text>
                  </Text>
                </View>
                <ProgressBar percent={line.percentUsed ?? 0} height={6} />
                {!line.tracked && line.budgeted > 0 && (
                  <Text style={lineStyles.note}>No spend recorded against this category yet</Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Labor spend by trade */}
        {trades.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Labor by Trade</Text>
            {trades.map((trade) => (
              <View key={trade.trade} style={lineStyles.row}>
                <View style={lineStyles.header}>
                  <Text style={lineStyles.label}>{humanize(trade.trade)}</Text>
                  <Text style={lineStyles.amounts}>
                    {formatMoney(trade.spent)}
                    {trade.budgeted > 0 && (
                      <Text style={lineStyles.budgeted}> / {formatMoney(trade.budgeted)}</Text>
                    )}
                  </Text>
                </View>
                {trade.budgeted > 0 && (
                  <ProgressBar
                    percent={Math.round((trade.spent / trade.budgeted) * 100)}
                    height={6}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Team assignments */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Teams on Site</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setSelectedTeamId(null);
                setPaymentType(PaymentType.DAILY_WAGE);
                setAgreedTotal('');
                setAssignModalVisible(true);
              }}
            >
              <Text style={styles.addButtonText}>+ Assign</Text>
            </TouchableOpacity>
          </View>

          {assignments.length === 0 ? (
            <Text style={styles.emptyText}>No teams assigned to this site.</Text>
          ) : (
            assignments.map((assignment) => {
              const team = typeof assignment.teamId === 'string' ? null : assignment.teamId;
              return (
                <View key={assignment._id} style={teamStyles.row}>
                  <View style={teamStyles.info}>
                    <Text style={teamStyles.name}>{team?.name || 'Unknown team'}</Text>
                    <Text style={teamStyles.meta}>
                      {humanize(team?.trade)} · {humanize(assignment.paymentType)} · since{' '}
                      {formatDate(assignment.assignedDate)}
                    </Text>
                    {!!assignment.agreedTotal && (
                      <Text style={teamStyles.agreed}>
                        Agreed total {formatMoney(assignment.agreedTotal)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={teamStyles.removeButton}
                    onPress={() => handleUnassign(assignment)}
                  >
                    <Text style={teamStyles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Recent money movements */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>No payments or purchases recorded yet.</Text>
          ) : (
            transactions.map((transaction) => (
              <View key={`${transaction.kind}-${transaction.id}`} style={txStyles.row}>
                <View
                  style={[
                    txStyles.indicator,
                    {
                      backgroundColor:
                        transaction.kind === 'payment' ? colors.primary[500] : colors.accent[700],
                    },
                  ]}
                />
                <View style={txStyles.info}>
                  <Text style={txStyles.label} numberOfLines={1}>
                    {humanize(transaction.label)}
                  </Text>
                  <Text style={txStyles.meta}>
                    {formatDate(transaction.date)} ·{' '}
                    {transaction.kind === 'payment' ? 'Payment' : 'Material purchase'}
                  </Text>
                </View>
                <View style={txStyles.amountArea}>
                  <Text style={txStyles.amount}>{formatMoney(transaction.amount)}</Text>
                  {transaction.flagged && <Text style={txStyles.flag}>⚠ needs review</Text>}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Budget audit trail */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget Change History</Text>
          {budgetHistory.length === 0 ? (
            <Text style={styles.emptyText}>The budget has not been changed since creation.</Text>
          ) : (
            budgetHistory
              .slice()
              .reverse()
              .map((change, index) => (
                <View key={`${change.changedAt}-${index}`} style={historyStyles.row}>
                  <Text style={historyStyles.change}>
                    {formatMoney(change.previousTotal)} → {formatMoney(change.newTotal)}
                  </Text>
                  <Text style={historyStyles.meta}>
                    {change.changedBy} · {formatDate(change.changedAt)}
                  </Text>
                  {!!change.reason && <Text style={historyStyles.reason}>"{change.reason}"</Text>}
                </View>
              ))
          )}
        </View>
      </ScrollView>

      {/* Assign team modal */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>Assign a team</Text>

            <Text style={modalStyles.label}>Team</Text>
            <ScrollView style={modalStyles.list} nestedScrollEnabled>
              {availableTeams.length === 0 ? (
                <Text style={modalStyles.emptyText}>
                  Every team is already assigned to this site.
                </Text>
              ) : (
                availableTeams.map((team) => (
                  <TouchableOpacity
                    key={team._id}
                    style={[
                      modalStyles.option,
                      selectedTeamId === team._id && modalStyles.optionSelected,
                    ]}
                    onPress={() => setSelectedTeamId(team._id)}
                  >
                    <Text style={modalStyles.optionText}>{team.name}</Text>
                    <Text style={modalStyles.optionSub}>{humanize(team.trade)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Text style={modalStyles.label}>Payment type</Text>
            <View style={modalStyles.chipRow}>
              {PAYMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[modalStyles.chip, paymentType === type && modalStyles.chipSelected]}
                  onPress={() => setPaymentType(type)}
                >
                  <Text
                    style={[
                      modalStyles.chipText,
                      paymentType === type && modalStyles.chipTextSelected,
                    ]}
                  >
                    {humanize(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentType === PaymentType.LUMP_SUM && (
              <Input
                label="Agreed total (PKR)"
                value={agreedTotal}
                onChangeText={(value) => setAgreedTotal(value.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
              />
            )}

            <View style={modalStyles.buttonRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setAssignModalVisible(false)}
                style={modalStyles.flexButton}
              />
              <Button
                title="Assign team"
                onPress={handleAssign}
                loading={assigning}
                disabled={!selectedTeamId}
                style={modalStyles.flexButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SplitCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.splitCell, { borderTopColor: color }]}>
      <Text style={styles.splitValue}>{formatMoney(value)}</Text>
      <Text style={styles.splitLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  errorText: { ...typography.body, color: colors.danger.dark, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.md },
  projectName: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.sm },
  projectMeta: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing.xxs },
  headlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headlineValue: { ...typography.heading2, color: colors.text.primary },
  headlinePercent: { ...typography.heading3 },
  headlineSub: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  remainingText: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing.sm },
  splitRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  splitCell: {
    flex: 1,
    borderTopWidth: 3,
    paddingTop: spacing.sm,
  },
  splitValue: { ...typography.label, color: colors.text.primary },
  splitLabel: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  footnote: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.md },
  emptyText: { ...typography.bodySmall, color: colors.text.tertiary, paddingVertical: spacing.sm },
  addButton: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  addButtonText: { ...typography.label, color: colors.primary[700] },
});

const lineStyles = StyleSheet.create({
  row: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  label: { ...typography.bodySmall, color: colors.text.primary },
  amounts: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  budgeted: { ...typography.caption, color: colors.text.tertiary, fontWeight: '400' },
  note: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xs },
});

const teamStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  info: { flex: 1 },
  name: { ...typography.body, color: colors.text.primary },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  agreed: { ...typography.caption, color: colors.primary[600], marginTop: spacing.xxs },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { color: colors.danger.dark, fontSize: 14, fontWeight: '700' },
});

const txStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  indicator: { width: 4, height: 32, borderRadius: 2, marginRight: spacing.md },
  info: { flex: 1, paddingRight: spacing.sm },
  label: { ...typography.bodySmall, color: colors.text.primary },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  amountArea: { alignItems: 'flex-end' },
  amount: { ...typography.label, color: colors.text.primary },
  flag: { ...typography.caption, color: colors.warning.dark, marginTop: spacing.xxs },
});

const historyStyles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  change: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  reason: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.xs },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.background.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.lg },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  list: { maxHeight: 220 },
  option: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.background.input,
  },
  optionSelected: {
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  optionText: { ...typography.body, color: colors.text.primary },
  optionSub: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    padding: spacing.lg,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.input,
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: colors.role.owner },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextSelected: { color: colors.text.inverse, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  flexButton: { flex: 1 },
});
