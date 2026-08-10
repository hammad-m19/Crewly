import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';

interface TeamAssignment {
  assignmentId: string;
  projectId: string;
  projectName: string;
  projectLocation: string;
  paymentType: string;
  assignedDate: string;
}

interface AvailableTeam {
  teamId: string;
  name: string;
  trade: string;
  currentAssignments: TeamAssignment[];
  isAvailable: boolean;
}

interface ProjectOption {
  projectId: string;
  projectName: string;
  projectLocation: string;
}

export default function CoordinateScreen() {
  const [teams, setTeams] = useState<AvailableTeam[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assignment modal state
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTeamForAssign, setSelectedTeamForAssign] = useState<AvailableTeam | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('daily_wage');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [teamsRes, overviewRes] = await Promise.all([
        apiFetch<AvailableTeam[]>('/coordination/available-teams'),
        apiFetch<{ projects: ProjectOption[] }>('/coordination/overview'),
      ]);
      if (teamsRes.success && teamsRes.data) setTeams(teamsRes.data);
      if (overviewRes.success && overviewRes.data) {
        setProjects(
          (overviewRes.data as any).projects?.map((p: any) => ({
            projectId: p.projectId,
            projectName: p.projectName,
            projectLocation: p.projectLocation,
          })) || []
        );
      }
    } catch (e) {
      console.error('Failed to fetch coordination data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleAssign = async () => {
    if (!selectedTeamForAssign || !selectedProject) return;

    const result = await apiFetch('/coordination/assign', {
      method: 'POST',
      body: {
        projectId: selectedProject.projectId,
        teamId: selectedTeamForAssign.teamId,
        paymentType: selectedPaymentType,
      },
    });

    if (result.success) {
      Alert.alert('✅ Assigned', `${selectedTeamForAssign.name} assigned to ${selectedProject.projectName}`);
      setAssignModalVisible(false);
      setSelectedTeamForAssign(null);
      setSelectedProject(null);
      fetchData();
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to assign team');
    }
  };

  const handleUnassign = async (team: AvailableTeam, assignment: TeamAssignment) => {
    // Pre-check for warnings
    const checkResult = await apiFetch<{ warnings: string[]; hasWarnings: boolean }>(
      `/coordination/unassign-check/${assignment.assignmentId}`
    );

    if (checkResult.success && checkResult.data?.hasWarnings) {
      const warningText = checkResult.data.warnings.join('\n\n');
      Alert.alert(
        '⚠️ Warning',
        `This team has open issues:\n\n${warningText}\n\nAre you sure you want to unassign ${team.name} from ${assignment.projectName}?\n\n(Daily report history will be preserved.)`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unassign Anyway', style: 'destructive', onPress: () => performUnassign(team, assignment) },
        ]
      );
    } else {
      Alert.alert(
        'Unassign Team',
        `Remove ${team.name} from ${assignment.projectName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unassign', style: 'destructive', onPress: () => performUnassign(team, assignment) },
        ]
      );
    }
  };

  const performUnassign = async (team: AvailableTeam, assignment: TeamAssignment) => {
    const result = await apiFetch('/coordination/unassign', {
      method: 'POST',
      body: { assignmentId: assignment.assignmentId },
    });

    if (result.success) {
      Alert.alert('Done', `${team.name} unassigned from ${assignment.projectName}`);
      fetchData();
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to unassign team');
    }
  };

  const openAssignModal = (team: AvailableTeam) => {
    setSelectedTeamForAssign(team);
    setSelectedProject(null);
    setSelectedPaymentType('daily_wage');
    setAssignModalVisible(true);
  };

  if (loading && teams.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading teams…</Text>
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
            onRefresh={() => fetchData(true)}
            tintColor={colors.role.super_supervisor}
          />
        }
      >
        <Text style={styles.sectionTitle}>All Teams</Text>
        <Text style={styles.sectionSubtitle}>
          Tap + to assign a team, or swipe to unassign
        </Text>

        {teams.map(team => (
          <TeamCard
            key={team.teamId}
            team={team}
            onAssign={() => openAssignModal(team)}
            onUnassign={(assignment) => handleUnassign(team, assignment)}
          />
        ))}
      </ScrollView>

      {/* Assignment Modal */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>
              Assign {selectedTeamForAssign?.name}
            </Text>

            <Text style={modalStyles.label}>Select Project</Text>
            <ScrollView style={modalStyles.optionList} nestedScrollEnabled>
              {projects.map(p => (
                <TouchableOpacity
                  key={p.projectId}
                  style={[
                    modalStyles.optionRow,
                    selectedProject?.projectId === p.projectId && modalStyles.optionSelected,
                  ]}
                  onPress={() => setSelectedProject(p)}
                >
                  <Text style={modalStyles.optionText}>{p.projectName}</Text>
                  <Text style={modalStyles.optionSub}>{p.projectLocation}</Text>
                </TouchableOpacity>
              ))}
              {projects.length === 0 && (
                <Text style={modalStyles.emptyText}>No active projects</Text>
              )}
            </ScrollView>

            <Text style={modalStyles.label}>Payment Type</Text>
            <View style={modalStyles.paymentRow}>
              {['daily_wage', 'milestone', 'lump_sum'].map(pt => (
                <TouchableOpacity
                  key={pt}
                  style={[
                    modalStyles.paymentChip,
                    selectedPaymentType === pt && modalStyles.paymentChipSelected,
                  ]}
                  onPress={() => setSelectedPaymentType(pt)}
                >
                  <Text
                    style={[
                      modalStyles.paymentChipText,
                      selectedPaymentType === pt && modalStyles.paymentChipTextSelected,
                    ]}
                  >
                    {pt.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={modalStyles.buttonRow}>
              <TouchableOpacity
                style={modalStyles.cancelButton}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.confirmButton, !selectedProject && modalStyles.disabledButton]}
                onPress={handleAssign}
                disabled={!selectedProject}
              >
                <Text style={modalStyles.confirmText}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TeamCard({
  team,
  onAssign,
  onUnassign,
}: {
  team: AvailableTeam;
  onAssign: () => void;
  onUnassign: (assignment: TeamAssignment) => void;
}) {
  return (
    <View style={teamCardStyles.container}>
      <View style={teamCardStyles.header}>
        <View style={teamCardStyles.nameArea}>
          <Text style={teamCardStyles.name}>{team.name}</Text>
          <Text style={teamCardStyles.trade}>{team.trade.replace(/_/g, ' ')}</Text>
        </View>
        <View style={teamCardStyles.statusArea}>
          {team.isAvailable ? (
            <View style={teamCardStyles.availableBadge}>
              <Text style={teamCardStyles.availableText}>Available</Text>
            </View>
          ) : (
            <Text style={teamCardStyles.assignedCount}>
              {team.currentAssignments.length} site{team.currentAssignments.length !== 1 ? 's' : ''}
            </Text>
          )}
          <TouchableOpacity style={teamCardStyles.addButton} onPress={onAssign}>
            <Text style={teamCardStyles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current assignments */}
      {team.currentAssignments.map(a => (
        <View key={a.assignmentId} style={teamCardStyles.assignmentRow}>
          <View style={teamCardStyles.assignmentInfo}>
            <Text style={teamCardStyles.projectName}>📍 {a.projectName}</Text>
            <Text style={teamCardStyles.assignmentMeta}>
              {a.paymentType.replace(/_/g, ' ')} · since {a.assignedDate}
            </Text>
          </View>
          <TouchableOpacity
            style={teamCardStyles.removeButton}
            onPress={() => onUnassign(a)}
          >
            <Text style={teamCardStyles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  sectionTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.xs },
  sectionSubtitle: { ...typography.bodySmall, color: colors.text.tertiary, marginBottom: spacing.lg },
});

const teamCardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    marginBottom: spacing.md, ...shadows.sm, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg,
  },
  nameArea: {},
  name: { ...typography.heading4, color: colors.text.primary },
  trade: { ...typography.caption, color: colors.text.tertiary, textTransform: 'capitalize', marginTop: spacing.xxs },
  statusArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  availableBadge: {
    backgroundColor: colors.success.light, borderRadius: borderRadius.full,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
  },
  availableText: { ...typography.caption, color: colors.success.dark, fontWeight: '600' },
  assignedCount: { ...typography.caption, color: colors.text.tertiary },
  addButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.role.super_supervisor,
    justifyContent: 'center', alignItems: 'center',
  },
  addButtonText: { color: colors.text.inverse, fontSize: 18, fontWeight: '700' },
  assignmentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.neutral[100],
  },
  assignmentInfo: { flex: 1 },
  projectName: { ...typography.body, color: colors.text.primary },
  assignmentMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs, textTransform: 'capitalize' },
  removeButton: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.danger.light,
    justifyContent: 'center', alignItems: 'center',
  },
  removeButtonText: { color: colors.danger.dark, fontSize: 14, fontWeight: '700' },
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
    maxHeight: '80%',
  },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.sm, marginTop: spacing.lg },
  optionList: { maxHeight: 200 },
  optionRow: {
    padding: spacing.md, borderRadius: borderRadius.md,
    marginBottom: spacing.xs, backgroundColor: colors.background.input,
  },
  optionSelected: { backgroundColor: colors.primary[50], borderWidth: 2, borderColor: colors.primary[500] },
  optionText: { ...typography.body, color: colors.text.primary },
  optionSub: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  emptyText: { ...typography.bodySmall, color: colors.text.tertiary, textAlign: 'center', padding: spacing.lg },
  paymentRow: { flexDirection: 'row', gap: spacing.sm },
  paymentChip: {
    flex: 1, paddingVertical: spacing.md,
    borderRadius: borderRadius.md, backgroundColor: colors.background.input,
    alignItems: 'center',
  },
  paymentChipSelected: { backgroundColor: colors.role.super_supervisor },
  paymentChipText: { ...typography.caption, color: colors.text.secondary, textTransform: 'capitalize' },
  paymentChipTextSelected: { color: colors.text.inverse, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing['2xl'] },
  cancelButton: {
    flex: 1, paddingVertical: spacing.lg, borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100], alignItems: 'center',
  },
  cancelText: { ...typography.button, color: colors.text.secondary },
  confirmButton: {
    flex: 1, paddingVertical: spacing.lg, borderRadius: borderRadius.md,
    backgroundColor: colors.role.super_supervisor, alignItems: 'center',
  },
  disabledButton: { opacity: 0.4 },
  confirmText: { ...typography.button, color: colors.text.inverse },
});
