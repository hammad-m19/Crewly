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
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { PaymentRecordType } from '@crewly/shared';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatDate, humanize, todayIso, isValidDateInput } from '../../lib/format';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

interface WageItem {
  dailyReportId: string;
  date: string;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
  trade: string | null;
  headcount: number;
  attendanceStatus: string;
  dailyRate: number | null;
  suggestedAmount: number | null;
}

interface MilestoneItem {
  dailyReportId: string;
  date: string;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
  trade: string | null;
  taskWorkedOn: string;
}

interface LumpSumItem {
  assignmentId: string;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
  trade: string | null;
  assignedDate: string;
  agreedTotal: number | null;
  paidSoFar: number;
  remaining: number | null;
  lastInstallmentDate: string | null;
}

interface QueueData {
  lookbackDays: number;
  counts: { dailyWages: number; milestones: number; lumpSums: number };
  dailyWages: WageItem[];
  milestones: MilestoneItem[];
  lumpSums: LumpSumItem[];
}

/** What the record-payment modal needs to build the POST /payments body. */
interface PendingPayment {
  type: PaymentRecordType;
  projectId: string;
  teamId: string;
  title: string;
  detail: string;
  suggestedAmount: number | null;
  maxAmount: number | null;
  linkedDailyReportId?: string;
  linkedTeamSiteAssignmentId?: string;
}

export default function PaymentQueue() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await apiFetch<QueueData>('/accountant/payment-queue');
    if (result.success && result.data) {
      setData(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error?.message || 'Could not load the payment queue.');
    }
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchQueue();
    }, [fetchQueue])
  );

  const openPayment = (payment: PendingPayment) => {
    setPending(payment);
    setAmount(payment.suggestedAmount !== null ? String(payment.suggestedAmount) : '');
    setDate(todayIso());
    setNotes('');
    setFormError(null);
  };

  const handleRecord = async () => {
    if (!pending) return;
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a positive amount.');
      return;
    }
    if (pending.maxAmount !== null && parsedAmount > pending.maxAmount) {
      setFormError(`At most ${formatMoney(pending.maxAmount)} remains on this agreement.`);
      return;
    }
    if (!isValidDateInput(date)) {
      setFormError('Date must be in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    const result = await apiFetch('/payments', {
      method: 'POST',
      body: {
        projectId: pending.projectId,
        teamId: pending.teamId,
        type: pending.type,
        amount: parsedAmount,
        date,
        linkedDailyReportId: pending.linkedDailyReportId,
        linkedTeamSiteAssignmentId: pending.linkedTeamSiteAssignmentId,
        notes,
      },
    });
    setSaving(false);

    if (result.success) {
      setPending(null);
      fetchQueue();
    } else {
      setFormError(result.error?.message || 'Could not record the payment.');
    }
  };

  if (!data && loadError) {
    return (
      <View style={styles.container}>
        <ErrorState message={loadError} onRetry={() => fetchQueue(true)} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton rows={6} />
      </View>
    );
  }

  const totalPending = data.counts.dailyWages + data.counts.milestones + data.counts.lumpSums;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchQueue(true)} />
        }
      >
        {totalPending === 0 ? (
          <EmptyState
            title="Queue clear"
            message={`Nothing awaiting payment in the last ${data.lookbackDays} days.`}
          />
        ) : (
          <Text style={styles.intro}>
            {`${totalPending} item${totalPending === 1 ? '' : 's'} awaiting payment from the last ${data.lookbackDays} days.`}
          </Text>
        )}

        {loadError && (
          <ErrorState
            title="Could not refresh"
            message={loadError}
            onRetry={() => fetchQueue(true)}
            style={styles.inlineError}
          />
        )}

        <Section emoji="👷" title="Daily Wages Due" count={data.counts.dailyWages}>
          {data.dailyWages.map((item) => (
            <QueueRow
              key={`${item.dailyReportId}_${item.teamId}`}
              title={item.teamName}
              subtitle={`${item.projectName} · ${formatDate(item.date)} · ${item.headcount} present${
                item.attendanceStatus === 'half_day' ? ' (half day)' : ''
              }`}
              amountLabel={
                item.suggestedAmount !== null
                  ? formatMoney(item.suggestedAmount)
                  : 'No rate set'
              }
              onPress={() =>
                openPayment({
                  type: PaymentRecordType.DAILY_WAGE,
                  projectId: item.projectId,
                  teamId: item.teamId,
                  title: `Daily wage — ${item.teamName}`,
                  detail: `${item.projectName} · ${formatDate(item.date)} · ${item.headcount} present${
                    item.dailyRate !== null
                      ? ` @ ${formatMoney(item.dailyRate)}/day`
                      : ' — no team rate set, enter total manually'
                  }`,
                  suggestedAmount: item.suggestedAmount,
                  maxAmount: null,
                  linkedDailyReportId: item.dailyReportId,
                })
              }
            />
          ))}
        </Section>

        <Section emoji="🎯" title="Milestone Payments" count={data.counts.milestones}>
          {data.milestones.map((item) => (
            <QueueRow
              key={`${item.dailyReportId}_${item.teamId}`}
              title={item.teamName}
              subtitle={`${item.projectName} · ${formatDate(item.date)}${
                item.taskWorkedOn ? ` · ${item.taskWorkedOn}` : ''
              }`}
              amountLabel="Verified ✓"
              onPress={() =>
                openPayment({
                  type: PaymentRecordType.MILESTONE,
                  projectId: item.projectId,
                  teamId: item.teamId,
                  title: `Milestone — ${item.teamName}`,
                  detail: `${item.projectName} · verified task${
                    item.taskWorkedOn ? `: ${item.taskWorkedOn}` : ''
                  }`,
                  suggestedAmount: null,
                  maxAmount: null,
                  linkedDailyReportId: item.dailyReportId,
                })
              }
            />
          ))}
        </Section>

        <Section emoji="📄" title="Lump-Sum Installments" count={data.counts.lumpSums}>
          {data.lumpSums.map((item) => (
            <QueueRow
              key={item.assignmentId}
              title={item.teamName}
              subtitle={`${item.projectName} · paid ${formatMoney(item.paidSoFar)}${
                item.agreedTotal !== null ? ` of ${formatMoney(item.agreedTotal)}` : ''
              }${
                item.lastInstallmentDate ? ` · last ${formatDate(item.lastInstallmentDate)}` : ''
              }`}
              amountLabel={item.remaining !== null ? `${formatMoney(item.remaining)} left` : 'Open'}
              onPress={() =>
                openPayment({
                  type: PaymentRecordType.LUMP_SUM_INSTALLMENT,
                  projectId: item.projectId,
                  teamId: item.teamId,
                  title: `Installment — ${item.teamName}`,
                  detail: `${item.projectName} · ${
                    item.remaining !== null
                      ? `${formatMoney(item.remaining)} remaining of ${formatMoney(item.agreedTotal)}`
                      : 'no agreed total recorded'
                  }`,
                  suggestedAmount: null,
                  maxAmount: item.remaining,
                  linkedTeamSiteAssignmentId: item.assignmentId,
                })
              }
            />
          ))}
        </Section>
      </ScrollView>

      <Modal visible={pending !== null} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>{pending?.title}</Text>
            <Text style={modalStyles.detail}>{pending?.detail}</Text>

            <Input
              label="Amount (Rs)"
              required
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder={
                pending?.suggestedAmount !== null && pending?.suggestedAmount !== undefined
                  ? String(pending.suggestedAmount)
                  : 'e.g. 25000'
              }
            />
            <Input
              label="Payment date"
              required
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional reference or remarks"
            />

            {formError && <Text style={modalStyles.formError}>{formError}</Text>}

            <Button
              title={`Record ${humanize(pending?.type || '')}`}
              onPress={handleRecord}
              loading={saving}
              fullWidth
              style={{ backgroundColor: colors.role.accountant }}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setPending(null)}
              fullWidth
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Section({
  emoji,
  title,
  count,
  children,
}: {
  emoji: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.emoji}>{emoji}</Text>
        <Text style={sectionStyles.title}>{title}</Text>
        <View style={[sectionStyles.badge, count > 0 && sectionStyles.badgeActive]}>
          <Text style={[sectionStyles.badgeText, count > 0 && sectionStyles.badgeTextActive]}>
            {count}
          </Text>
        </View>
      </View>
      {count === 0 ? (
        <View style={sectionStyles.emptyRow}>
          <Text style={sectionStyles.emptyText}>No pending payments</Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

function QueueRow({
  title,
  subtitle,
  amountLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  amountLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={rowStyles.textArea}>
        <Text style={rowStyles.title}>{title}</Text>
        <Text style={rowStyles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={rowStyles.amount}>{amountLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  intro: { ...typography.bodySmall, color: colors.text.tertiary, marginBottom: spacing.lg },
  inlineError: {
    flex: 0,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
});

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  emoji: { fontSize: 22, marginRight: spacing.md },
  title: { ...typography.heading4, color: colors.text.primary, flex: 1 },
  badge: {
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    minWidth: 28,
    height: 28,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeActive: { backgroundColor: colors.role.accountant },
  badgeText: { ...typography.label, color: colors.neutral[600] },
  badgeTextActive: { color: colors.text.inverse },
  emptyRow: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { ...typography.bodySmall, color: colors.text.tertiary },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  textArea: { flex: 1, paddingRight: spacing.md },
  title: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  subtitle: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  amount: { ...typography.bodySmall, color: colors.role.accountant, fontWeight: '700' },
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
    marginBottom: spacing.xl,
  },
  formError: {
    ...typography.bodySmall,
    color: colors.danger.dark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
