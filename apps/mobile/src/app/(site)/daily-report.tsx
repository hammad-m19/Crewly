import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useSyncStore } from '../../store/syncStore';
import { AttendanceStatus, IdleReason, TeamEntry } from '@crewly/shared';
import Badge from '../../components/ui/Badge';
import StatusChip from '../../components/ui/StatusChip';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

/**
 * Daily Report form — the primary screen for Site Supervisors.
 *
 * Design: Card-per-team with inline attendance, task, and idle selection.
 * Saves locally immediately (WatermelonDB), syncs in background.
 */

// TODO: Pull from WatermelonDB/assignments once sync is wired up
const MOCK_ASSIGNED_TEAMS = [
  { id: 'team1', name: "Umair's Electric Team", trade: 'electric' },
  { id: 'team2', name: 'Asif Wood Works', trade: 'wood' },
  { id: 'team3', name: 'Kamran Plumbing', trade: 'plumber' },
];

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; emoji: string }[] = [
  { value: AttendanceStatus.ON_TIME, label: 'On Time', emoji: '✅' },
  { value: AttendanceStatus.HALF_DAY, label: 'Half Day', emoji: '🕐' },
  { value: AttendanceStatus.EVENING_SHIFT, label: 'Evening', emoji: '🌙' },
  { value: AttendanceStatus.NO_SHOW, label: 'No-Show', emoji: '🚫' },
];

const IDLE_REASONS: { value: IdleReason; label: string }[] = [
  { value: IdleReason.MATERIAL_NOT_THERE, label: 'Material not available' },
  { value: IdleReason.WAITING_ON_OTHER_TRADE, label: 'Waiting on other trade' },
  { value: IdleReason.WEATHER, label: 'Bad weather' },
  { value: IdleReason.OTHER, label: 'Other reason' },
];

interface TeamReportEntry {
  teamId: string;
  teamName: string;
  trade: string;
  isLocalLabor: boolean;
  headcountPresent: number;
  attendanceStatus: AttendanceStatus;
  idleReason: IdleReason | null;
  idleReasonNotes: string;
  taskWorkedOn: string;
  taskCompleted: boolean;
  photos: string[];
}

export default function DailyReportForm() {
  const { isOnline, lastError } = useSyncStore();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const todayISO = new Date().toISOString().split('T')[0];

  // Landing load gate — reserved for WatermelonDB assignment fetch
  const [teamsLoading] = useState(false);

  // Initialize team entries
  const [entries, setEntries] = useState<TeamReportEntry[]>(
    MOCK_ASSIGNED_TEAMS.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      trade: team.trade,
      isLocalLabor: false,
      headcountPresent: 0,
      attendanceStatus: AttendanceStatus.ON_TIME,
      idleReason: null,
      idleReasonNotes: '',
      taskWorkedOn: '',
      taskCompleted: false,
      photos: [],
    }))
  );

  const [localLaborCount, setLocalLaborCount] = useState(0);
  const [showIdleModal, setShowIdleModal] = useState<number | null>(null);
  const [isDraft, setIsDraft] = useState(true);

  const updateEntry = useCallback(
    (index: number, updates: Partial<TeamReportEntry>) => {
      setEntries((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    []
  );

  const handleSubmit = () => {
    // Validate
    const incomplete = entries.filter(
      (e) =>
        e.attendanceStatus !== AttendanceStatus.NO_SHOW &&
        !e.taskWorkedOn.trim()
    );

    if (incomplete.length > 0) {
      Alert.alert(
        'Incomplete Report',
        `${incomplete.map((e) => e.teamName).join(', ')} — please enter what task was worked on.`
      );
      return;
    }

    // Build team entries for API
    const teamEntries: TeamEntry[] = entries.map((e) => ({
      teamId: e.isLocalLabor ? null : e.teamId,
      isLocalLabor: e.isLocalLabor,
      headcountPresent: e.headcountPresent,
      attendanceStatus: e.attendanceStatus,
      idleReason: e.idleReason,
      idleReasonNotes: e.idleReasonNotes,
      taskWorkedOn: e.taskWorkedOn,
      taskCompleted: e.taskCompleted,
      photos: e.photos,
    }));

    // Add local labor if any
    if (localLaborCount > 0) {
      teamEntries.push({
        teamId: null,
        isLocalLabor: true,
        headcountPresent: localLaborCount,
        attendanceStatus: AttendanceStatus.ON_TIME,
        taskWorkedOn: 'Various local labor tasks',
        taskCompleted: false,
        photos: [],
      });
    }

    // TODO: Save to WatermelonDB, then trigger sync
    Alert.alert(
      '✅ Report Saved',
      `Report for ${todayISO} saved locally.${
        isOnline ? ' Syncing...' : '\n\nYou are offline — it will sync when you reconnect.'
      }`,
      [{ text: 'OK' }]
    );
    setIsDraft(false);
  };

  if (teamsLoading) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton rows={5} />
      </View>
    );
  }

  if (lastError && entries.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={lastError} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No teams assigned"
          message="Ask a Super Supervisor to assign teams to this site before filing today's report."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date & Status Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{today}</Text>
          <Text style={styles.projectName}>
            Site: Project Alpha {/* TODO: real project name */}
          </Text>
        </View>
        <Badge
          label={isDraft ? 'Draft' : 'Submitted'}
          variant={isDraft ? 'neutral' : 'success'}
          size="md"
        />
      </View>

      {/* Team Cards */}
      {entries.map((entry, index) => (
        <TeamCard
          key={entry.teamId}
          entry={entry}
          index={index}
          onUpdate={updateEntry}
          onShowIdleModal={() => setShowIdleModal(index)}
        />
      ))}

      {/* Local Labor Section */}
      <View style={styles.localLaborCard}>
        <View style={styles.localLaborHeader}>
          <Text style={styles.localLaborTitle}>👷 Local Labor</Text>
          <Text style={styles.localLaborSubtitle}>Headcount only — no team tracking</Text>
        </View>
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setLocalLaborCount(Math.max(0, localLaborCount - 1))}
          >
            <Text style={styles.counterButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterValue}>{localLaborCount}</Text>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setLocalLaborCount(localLaborCount + 1)}
          >
            <Text style={styles.counterButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit Button */}
      <Button
        title={isDraft ? '📤 Submit Report' : '✅ Report Submitted'}
        onPress={handleSubmit}
        variant={isDraft ? 'primary' : 'secondary'}
        size="lg"
        fullWidth
        disabled={!isDraft}
      />

      {/* Idle Reason Modal */}
      {showIdleModal !== null && (
        <IdleReasonModal
          visible={true}
          currentReason={entries[showIdleModal].idleReason}
          currentNotes={entries[showIdleModal].idleReasonNotes}
          onSelect={(reason, notes) => {
            updateEntry(showIdleModal, { idleReason: reason, idleReasonNotes: notes });
            setShowIdleModal(null);
          }}
          onClose={() => setShowIdleModal(null)}
        />
      )}
    </ScrollView>
  );
}

/**
 * Team card component — one per assigned team.
 */
function TeamCard({
  entry,
  index,
  onUpdate,
  onShowIdleModal,
}: {
  entry: TeamReportEntry;
  index: number;
  onUpdate: (index: number, updates: Partial<TeamReportEntry>) => void;
  onShowIdleModal: () => void;
}) {
  const isNoShow = entry.attendanceStatus === AttendanceStatus.NO_SHOW;

  return (
    <View style={teamStyles.card}>
      {/* Team Header */}
      <View style={teamStyles.header}>
        <View style={teamStyles.headerLeft}>
          <Text style={teamStyles.teamName}>{entry.teamName}</Text>
          <Badge label={entry.trade} variant="primary" />
        </View>
        <StatusChip status={entry.attendanceStatus} />
      </View>

      {/* Attendance Row */}
      <View style={teamStyles.attendanceRow}>
        {ATTENDANCE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              teamStyles.attendanceChip,
              entry.attendanceStatus === opt.value && teamStyles.attendanceChipActive,
            ]}
            onPress={() => {
              onUpdate(index, { attendanceStatus: opt.value });
              // If idle (no-show), show idle reason modal
              if (opt.value === AttendanceStatus.NO_SHOW) {
                onShowIdleModal();
              }
            }}
          >
            <Text style={teamStyles.attendanceEmoji}>{opt.emoji}</Text>
            <Text
              style={[
                teamStyles.attendanceLabel,
                entry.attendanceStatus === opt.value && teamStyles.attendanceLabelActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Headcount */}
      {!isNoShow && (
        <View style={teamStyles.fieldRow}>
          <Text style={teamStyles.fieldLabel}>Workers present</Text>
          <View style={teamStyles.counterRow}>
            <TouchableOpacity
              style={teamStyles.counterBtn}
              onPress={() =>
                onUpdate(index, { headcountPresent: Math.max(0, entry.headcountPresent - 1) })
              }
            >
              <Text style={teamStyles.counterText}>−</Text>
            </TouchableOpacity>
            <Text style={teamStyles.counterValue}>{entry.headcountPresent}</Text>
            <TouchableOpacity
              style={teamStyles.counterBtn}
              onPress={() => onUpdate(index, { headcountPresent: entry.headcountPresent + 1 })}
            >
              <Text style={teamStyles.counterText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task Worked On */}
      {!isNoShow && (
        <View style={teamStyles.taskSection}>
          <Text style={teamStyles.fieldLabel}>Task worked on</Text>
          <TextInput
            style={teamStyles.taskInput}
            placeholder="e.g. Wiring 2nd floor bedrooms"
            placeholderTextColor={colors.neutral[400]}
            value={entry.taskWorkedOn}
            onChangeText={(text) => onUpdate(index, { taskWorkedOn: text })}
            multiline
          />
          <TouchableOpacity
            style={teamStyles.checkRow}
            onPress={() => onUpdate(index, { taskCompleted: !entry.taskCompleted })}
          >
            <View
              style={[
                teamStyles.checkbox,
                entry.taskCompleted && teamStyles.checkboxChecked,
              ]}
            >
              {entry.taskCompleted && <Text style={teamStyles.checkmark}>✓</Text>}
            </View>
            <Text style={teamStyles.checkLabel}>Task completed</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Idle reason indicator */}
      {entry.idleReason && (
        <TouchableOpacity style={teamStyles.idleIndicator} onPress={onShowIdleModal}>
          <Text style={teamStyles.idleText}>
            ⚠️ Idle: {entry.idleReason.replace(/_/g, ' ')}
            {entry.idleReasonNotes ? ` — ${entry.idleReasonNotes}` : ''}
          </Text>
          <Text style={teamStyles.idleEdit}>Edit</Text>
        </TouchableOpacity>
      )}

      {/* Photo button placeholder */}
      {!isNoShow && (
        <TouchableOpacity
          style={teamStyles.photoButton}
          onPress={() => Alert.alert('Coming Soon', 'Photo capture will be wired in Phase 2 completion.')}
        >
          <Text style={teamStyles.photoButtonText}>📸 Add Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Modal for selecting idle reason + optional notes.
 */
function IdleReasonModal({
  visible,
  currentReason,
  currentNotes,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentReason: IdleReason | null;
  currentNotes: string;
  onSelect: (reason: IdleReason, notes: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<IdleReason | null>(currentReason);
  const [notes, setNotes] = useState(currentNotes);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>Why is this team idle?</Text>
          <Text style={modalStyles.subtitle}>This is required — it helps prevent future blocks</Text>

          {IDLE_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                modalStyles.option,
                selected === reason.value && modalStyles.optionSelected,
              ]}
              onPress={() => setSelected(reason.value)}
            >
              <View
                style={[
                  modalStyles.radio,
                  selected === reason.value && modalStyles.radioSelected,
                ]}
              />
              <Text style={modalStyles.optionLabel}>{reason.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={modalStyles.notesInput}
            placeholder="Additional notes (optional)"
            placeholderTextColor={colors.neutral[400]}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <View style={modalStyles.actions}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button
              title="Confirm"
              variant="primary"
              disabled={!selected}
              onPress={() => selected && onSelect(selected, notes)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['6xl'] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing['2xl'],
  },
  dateText: { ...typography.heading3, color: colors.text.primary },
  projectName: { ...typography.bodySmall, color: colors.text.tertiary, marginTop: spacing.xxs },
  localLaborCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
    ...shadows.sm,
  },
  localLaborHeader: { marginBottom: spacing.lg },
  localLaborTitle: { ...typography.heading4, color: colors.text.primary },
  localLaborSubtitle: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonText: { fontSize: 24, color: colors.text.primary },
  counterValue: { ...typography.heading2, color: colors.text.primary, minWidth: 40, textAlign: 'center' },
});

const teamStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: { flex: 1, gap: spacing.sm },
  teamName: { ...typography.heading4, color: colors.text.primary },
  attendanceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  attendanceChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  attendanceChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  attendanceEmoji: { fontSize: 20, marginBottom: spacing.xxs },
  attendanceLabel: { ...typography.caption, color: colors.text.tertiary },
  attendanceLabelActive: { color: colors.primary[700], fontWeight: '600' },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  fieldLabel: { ...typography.label, color: colors.text.secondary },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: { fontSize: 20, color: colors.text.primary },
  counterValue: { ...typography.heading4, color: colors.text.primary, minWidth: 28, textAlign: 'center' },
  taskSection: { marginBottom: spacing.md },
  taskInput: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.success.main,
    borderColor: colors.success.main,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkLabel: { ...typography.body, color: colors.text.secondary },
  idleIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.warning.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  idleText: { ...typography.bodySmall, color: colors.warning.dark, flex: 1 },
  idleEdit: { ...typography.label, color: colors.primary[500], marginLeft: spacing.md },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
  },
  photoButtonText: { ...typography.label, color: colors.text.tertiary },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.bodySmall, color: colors.text.tertiary, marginBottom: spacing.xl },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  optionSelected: { backgroundColor: colors.primary[50] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[300],
  },
  radioSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  optionLabel: { ...typography.body, color: colors.text.primary },
  notesInput: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing.lg,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
