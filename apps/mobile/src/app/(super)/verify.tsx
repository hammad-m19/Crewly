import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';

interface PendingTask {
  dailyReportId: string;
  teamEntryIndex: number;
  projectId: string;
  date: string;
  submittedBy: string;
  teamId: string | null;
  isLocalLabor: boolean;
  taskWorkedOn: string;
  headcountPresent: number;
  teamName: string;
  teamTrade: string;
  projectName: string;
  projectLocation: string;
}

export default function VerifyScreen() {
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Verification modal state
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PendingTask | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await apiFetch<PendingTask[]>('/verifications/pending');
      if (result.success && result.data) {
        setPendingTasks(result.data);
      }
    } catch (e) {
      console.error('Failed to fetch pending verifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPending();
    }, [fetchPending])
  );

  const openVerifyModal = (task: PendingTask) => {
    setSelectedTask(task);
    setVerifyNotes('');
    setVerifyModalVisible(true);
  };

  const handleVerify = async () => {
    if (!selectedTask) return;
    setSubmitting(true);

    try {
      const result = await apiFetch('/verifications', {
        method: 'POST',
        body: {
          dailyReportId: selectedTask.dailyReportId,
          teamEntryIndex: selectedTask.teamEntryIndex,
          notes: verifyNotes.trim(),
        },
      });

      if (result.success) {
        Alert.alert('✅ Verified', `Task verified for ${selectedTask.teamName}`);
        setVerifyModalVisible(false);
        setSelectedTask(null);
        fetchPending();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to verify task');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickVerify = async (task: PendingTask) => {
    const result = await apiFetch('/verifications', {
      method: 'POST',
      body: {
        dailyReportId: task.dailyReportId,
        teamEntryIndex: task.teamEntryIndex,
        notes: '',
      },
    });

    if (result.success) {
      // Optimistically remove from list
      setPendingTasks(prev => prev.filter(
        t => !(t.dailyReportId === task.dailyReportId && t.teamEntryIndex === task.teamEntryIndex)
      ));
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to verify task');
    }
  };

  if (loading && pendingTasks.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading pending verifications…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPending(true)}
            tintColor={colors.role.super_supervisor}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Pending Verifications</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{pendingTasks.length}</Text>
          </View>
        </View>

        {pendingTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>All Tasks Verified!</Text>
            <Text style={styles.emptySubtitle}>
              No tasks pending verification right now.
              {'\n'}Check back after Site Supervisors submit reports.
            </Text>
          </View>
        ) : (
          pendingTasks.map((task, index) => (
            <TaskCard
              key={`${task.dailyReportId}_${task.teamEntryIndex}`}
              task={task}
              onQuickVerify={() => handleQuickVerify(task)}
              onVerifyWithNotes={() => openVerifyModal(task)}
            />
          ))
        )}
      </ScrollView>

      {/* Verification Modal */}
      <Modal visible={verifyModalVisible} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>Verify Task</Text>

            {selectedTask && (
              <View style={modalStyles.taskSummary}>
                <Text style={modalStyles.taskTeam}>{selectedTask.teamName}</Text>
                <Text style={modalStyles.taskProject}>
                  {selectedTask.projectName} · {selectedTask.date}
                </Text>
                <Text style={modalStyles.taskDesc}>{selectedTask.taskWorkedOn}</Text>
              </View>
            )}

            <Text style={modalStyles.label}>Notes (optional)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="Add verification notes..."
              placeholderTextColor={colors.neutral[400]}
              value={verifyNotes}
              onChangeText={setVerifyNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={modalStyles.buttonRow}>
              <TouchableOpacity
                style={modalStyles.cancelButton}
                onPress={() => setVerifyModalVisible(false)}
              >
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.confirmButton, submitting && modalStyles.disabledButton]}
                onPress={handleVerify}
                disabled={submitting}
              >
                <Text style={modalStyles.confirmText}>
                  {submitting ? 'Verifying…' : '✅ Verify'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TaskCard({
  task,
  onQuickVerify,
  onVerifyWithNotes,
}: {
  task: PendingTask;
  onQuickVerify: () => void;
  onVerifyWithNotes: () => void;
}) {
  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.content}>
        <View style={cardStyles.topRow}>
          <View style={cardStyles.teamBadge}>
            <Text style={cardStyles.teamBadgeText}>
              {task.isLocalLabor ? '👷 Local Labor' : task.teamName}
            </Text>
          </View>
          <Text style={cardStyles.date}>{task.date}</Text>
        </View>

        <Text style={cardStyles.projectName}>{task.projectName}</Text>
        <Text style={cardStyles.location}>📍 {task.projectLocation}</Text>

        <View style={cardStyles.taskRow}>
          <Text style={cardStyles.taskLabel}>Task:</Text>
          <Text style={cardStyles.taskValue}>{task.taskWorkedOn || 'No description'}</Text>
        </View>

        <View style={cardStyles.taskRow}>
          <Text style={cardStyles.taskLabel}>Workers:</Text>
          <Text style={cardStyles.taskValue}>{task.headcountPresent} present</Text>
        </View>

        {task.teamTrade ? (
          <View style={cardStyles.tradePill}>
            <Text style={cardStyles.tradeText}>{task.teamTrade.replace(/_/g, ' ')}</Text>
          </View>
        ) : null}
      </View>

      <View style={cardStyles.actions}>
        <TouchableOpacity style={cardStyles.quickVerifyBtn} onPress={onQuickVerify}>
          <Text style={cardStyles.quickVerifyText}>✅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.notesBtn} onPress={onVerifyWithNotes}>
          <Text style={cardStyles.notesBtnText}>+ Notes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: { ...typography.heading3, color: colors.text.primary },
  countBadge: {
    backgroundColor: colors.role.super_supervisor,
    borderRadius: borderRadius.full,
    width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  countText: { ...typography.label, color: colors.text.inverse, fontWeight: '700' },
  emptyState: {
    alignItems: 'center', paddingVertical: spacing['4xl'],
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg, ...shadows.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  emptySubtitle: {
    ...typography.bodySmall, color: colors.text.tertiary,
    textAlign: 'center', paddingHorizontal: spacing.lg,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    marginBottom: spacing.md, ...shadows.sm, overflow: 'hidden',
  },
  content: { padding: spacing.lg },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  teamBadge: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  teamBadgeText: { ...typography.label, color: colors.primary[700] },
  date: { ...typography.caption, color: colors.text.tertiary },
  projectName: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  location: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs, marginBottom: spacing.md },
  taskRow: { flexDirection: 'row', marginBottom: spacing.xs },
  taskLabel: { ...typography.caption, color: colors.text.tertiary, width: 60 },
  taskValue: { ...typography.bodySmall, color: colors.text.primary, flex: 1 },
  tradePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  tradeText: { ...typography.caption, color: colors.accent[800], textTransform: 'capitalize' },
  actions: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.neutral[100],
  },
  quickVerifyBtn: {
    flex: 1, paddingVertical: spacing.md,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: colors.neutral[100],
  },
  quickVerifyText: { fontSize: 22 },
  notesBtn: {
    flex: 1, paddingVertical: spacing.md,
    justifyContent: 'center', alignItems: 'center',
  },
  notesBtnText: { ...typography.label, color: colors.role.super_supervisor },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: colors.background.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing['2xl'],
  },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.lg },
  taskSummary: {
    backgroundColor: colors.background.input, borderRadius: borderRadius.md,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  taskTeam: { ...typography.heading4, color: colors.text.primary },
  taskProject: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  taskDesc: { ...typography.body, color: colors.text.secondary, marginTop: spacing.sm },
  label: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.background.input, borderRadius: borderRadius.md,
    padding: spacing.lg, minHeight: 80, ...typography.body,
    color: colors.text.primary,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing['2xl'] },
  cancelButton: {
    flex: 1, paddingVertical: spacing.lg, borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100], alignItems: 'center',
  },
  cancelText: { ...typography.button, color: colors.text.secondary },
  confirmButton: {
    flex: 1, paddingVertical: spacing.lg, borderRadius: borderRadius.md,
    backgroundColor: colors.success.main, alignItems: 'center',
  },
  disabledButton: { opacity: 0.5 },
  confirmText: { ...typography.button, color: colors.text.inverse },
});
