import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface ExpenseLine {
  amount: number;
  date: string;
  description: string;
  hasReceipt: boolean;
}

interface Batch {
  pettyCashId: string;
  supervisorId: string;
  supervisorName: string;
  projectId: string;
  projectName: string;
  floatTotal: number;
  spentTotal: number;
  currentBalance: number;
  reconciled: boolean;
  expenseCount: number;
  expensesMissingReceipt: number;
  expenses: ExpenseLine[];
}

interface SupervisorOption {
  userId: string;
  name: string;
  assignedSites: string[];
}

interface ProjectOption {
  projectId: string;
  name: string;
  status: string;
}

interface ReconciliationData {
  counts: { unreconciled: number; reconciled: number };
  batches: Batch[];
  supervisors: SupervisorOption[];
  projects: ProjectOption[];
}

export default function Reconciliation() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Issue-float form
  const [floatModalVisible, setFloatModalVisible] = useState(false);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await apiFetch<ReconciliationData>('/accountant/reconciliation');
    if (result.success && result.data) {
      setData(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error?.message || 'Could not load petty cash data.');
    }
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const confirmReconcile = (batch: Batch) => {
    Alert.alert(
      'Reconcile batch?',
      `${batch.supervisorName} — ${batch.projectName}\nFloat ${formatMoney(batch.floatTotal)}, spent ${formatMoney(batch.spentTotal)}, balance ${formatMoney(batch.currentBalance)}.\n\nThis closes the batch and allows a new float.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reconcile', style: 'default', onPress: () => handleReconcile(batch.pettyCashId) },
      ]
    );
  };

  const handleReconcile = async (pettyCashId: string) => {
    setReconcilingId(pettyCashId);
    setActionError(null);
    const result = await apiFetch(`/petty-cash/${pettyCashId}/reconcile`, { method: 'POST' });
    setReconcilingId(null);
    if (result.success) {
      fetchData();
    } else {
      setActionError(result.error?.message || 'Could not reconcile that batch.');
    }
  };

  const openFloatModal = () => {
    setSupervisorId(null);
    setProjectId(null);
    setAmount('');
    setFormError(null);
    setFloatModalVisible(true);
  };

  const handleIssueFloat = async () => {
    const parsedAmount = Number(amount);
    if (!supervisorId) {
      setFormError('Choose a supervisor.');
      return;
    }
    if (!projectId) {
      setFormError('Choose a project.');
      return;
    }
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a positive amount.');
      return;
    }

    setIssuing(true);
    const result = await apiFetch('/petty-cash/issue-float', {
      method: 'POST',
      body: { siteSupervisorId: supervisorId, projectId, amount: parsedAmount },
    });
    setIssuing(false);

    if (result.success) {
      setFloatModalVisible(false);
      fetchData();
    } else {
      setFormError(result.error?.message || 'Could not issue the float.');
    }
  };

  if (!data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={loadError ? styles.errorText : styles.loadingText}>
          {loadError || 'Loading petty cash…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.intro}>
            {data.counts.unreconciled === 0
              ? 'All petty cash batches are reconciled.'
              : `${data.counts.unreconciled} batch${data.counts.unreconciled === 1 ? '' : 'es'} awaiting reconciliation.`}
          </Text>
          <Button
            title="Issue float"
            size="sm"
            onPress={openFloatModal}
            style={{ backgroundColor: colors.role.accountant }}
          />
        </View>

        {actionError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{actionError}</Text>
          </View>
        )}

        {data.batches.length === 0 && (
          <Text style={styles.emptyText}>No petty cash batches yet.</Text>
        )}

        {data.batches.map((batch) => {
          const expanded = expandedId === batch.pettyCashId;
          return (
            <View key={batch.pettyCashId} style={cardStyles.card}>
              <TouchableOpacity
                onPress={() => setExpandedId(expanded ? null : batch.pettyCashId)}
                activeOpacity={0.6}
              >
                <View style={cardStyles.topRow}>
                  <View style={cardStyles.titleArea}>
                    <Text style={cardStyles.supervisor}>{batch.supervisorName}</Text>
                    <Text style={cardStyles.project}>{batch.projectName}</Text>
                  </View>
                  <View
                    style={[
                      cardStyles.statusPill,
                      { backgroundColor: batch.reconciled ? colors.success.light : colors.warning.light },
                    ]}
                  >
                    <Text
                      style={[
                        cardStyles.statusText,
                        { color: batch.reconciled ? colors.success.dark : colors.warning.dark },
                      ]}
                    >
                      {batch.reconciled ? 'Reconciled' : 'Open'}
                    </Text>
                  </View>
                </View>

                <View style={cardStyles.figuresRow}>
                  <Figure label="Float" value={formatMoney(batch.floatTotal)} />
                  <Figure label="Spent" value={formatMoney(batch.spentTotal)} />
                  <Figure
                    label="Balance"
                    value={formatMoney(batch.currentBalance)}
                    highlight={batch.currentBalance < 0}
                  />
                </View>

                <Text style={cardStyles.meta}>
                  {batch.expenseCount} expense{batch.expenseCount === 1 ? '' : 's'}
                  {batch.expensesMissingReceipt > 0
                    ? ` · ${batch.expensesMissingReceipt} missing receipt${batch.expensesMissingReceipt === 1 ? '' : 's'}`
                    : ''}
                </Text>
              </TouchableOpacity>

              {expanded && batch.expenses.length > 0 && (
                <View style={cardStyles.expenseList}>
                  {batch.expenses.map((expense, index) => (
                    <View key={index} style={cardStyles.expenseRow}>
                      <View style={cardStyles.expenseTextArea}>
                        <Text style={cardStyles.expenseDescription}>{expense.description}</Text>
                        <Text style={cardStyles.expenseMeta}>
                          {formatDate(expense.date)}
                          {!expense.hasReceipt ? ' · no receipt' : ''}
                        </Text>
                      </View>
                      <Text style={cardStyles.expenseAmount}>{formatMoney(expense.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!batch.reconciled && (
                <Button
                  title={reconcilingId === batch.pettyCashId ? 'Reconciling…' : 'Reconcile batch'}
                  variant="outline"
                  size="sm"
                  onPress={() => confirmReconcile(batch)}
                  disabled={reconcilingId === batch.pettyCashId}
                  style={cardStyles.reconcileButton}
                  textStyle={{ color: colors.role.accountant }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={floatModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>Issue new float</Text>
            <Text style={modalStyles.detail}>
              A new float is blocked while the supervisor has an unreconciled batch on the same
              project.
            </Text>

            <Text style={modalStyles.pickerLabel}>Site Supervisor</Text>
            <View style={modalStyles.chipWrap}>
              {data.supervisors.map((supervisor) => {
                const active = supervisorId === supervisor.userId;
                return (
                  <TouchableOpacity
                    key={supervisor.userId}
                    style={[modalStyles.chip, active && modalStyles.chipActive]}
                    onPress={() => setSupervisorId(supervisor.userId)}
                  >
                    <Text style={[modalStyles.chipText, active && modalStyles.chipTextActive]}>
                      {supervisor.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={modalStyles.pickerLabel}>Project</Text>
            <View style={modalStyles.chipWrap}>
              {data.projects.map((project) => {
                const active = projectId === project.projectId;
                return (
                  <TouchableOpacity
                    key={project.projectId}
                    style={[modalStyles.chip, active && modalStyles.chipActive]}
                    onPress={() => setProjectId(project.projectId)}
                  >
                    <Text style={[modalStyles.chipText, active && modalStyles.chipTextActive]}>
                      {project.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Float amount (Rs)"
              required
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 50000"
            />

            {formError && <Text style={modalStyles.formError}>{formError}</Text>}

            <Button
              title="Issue float"
              onPress={handleIssueFloat}
              loading={issuing}
              fullWidth
              style={{ backgroundColor: colors.role.accountant }}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setFloatModalVisible(false)}
              fullWidth
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Figure({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={figureStyles.figure}>
      <Text style={figureStyles.label}>{label}</Text>
      <Text style={[figureStyles.value, highlight && { color: colors.danger.main }]}>{value}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  intro: { ...typography.bodySmall, color: colors.text.tertiary, flex: 1 },
  errorBanner: {
    backgroundColor: colors.danger.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.danger.dark, textAlign: 'center' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleArea: { flex: 1, paddingRight: spacing.md },
  supervisor: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  project: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  statusPill: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: { ...typography.caption, fontWeight: '600' },
  figuresRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm },
  expenseList: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  expenseTextArea: { flex: 1, paddingRight: spacing.md },
  expenseDescription: { ...typography.bodySmall, color: colors.text.primary },
  expenseMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: 1 },
  expenseAmount: { ...typography.bodySmall, color: colors.text.secondary, fontWeight: '600' },
  reconcileButton: {
    marginTop: spacing.md,
    borderColor: colors.role.accountant,
  },
});

const figureStyles = StyleSheet.create({
  figure: { flex: 1 },
  label: { ...typography.caption, color: colors.text.tertiary },
  value: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '700', marginTop: 1 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  title: { ...typography.heading3, color: colors.text.primary },
  detail: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  pickerLabel: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.sm },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[200],
  },
  chipActive: { backgroundColor: colors.role.accountant },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextActive: { color: colors.text.inverse, fontWeight: '600' },
  formError: {
    ...typography.bodySmall,
    color: colors.danger.dark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
