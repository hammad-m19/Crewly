import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { BudgetCategory, ProjectStatus } from '@crewly/shared';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatDate, humanize, isValidDateInput, todayIso } from '../../lib/format';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface Project {
  _id: string;
  name: string;
  location: string;
  startDate: string;
  expectedEndDate: string;
  status: ProjectStatus;
  budget: Partial<Record<BudgetCategory, number>>;
  budgetHistory: { changedAt: string; reason?: string }[];
  siteSupervisorId: string | null;
}

interface SupervisorOption {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

const BUDGET_CATEGORIES = Object.values(BudgetCategory);
const STATUS_OPTIONS = Object.values(ProjectStatus);

type BudgetDraft = Record<string, string>;

interface FormState {
  name: string;
  location: string;
  startDate: string;
  expectedEndDate: string;
  status: ProjectStatus;
  siteSupervisorId: string | null;
  budget: BudgetDraft;
  reason: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    location: '',
    startDate: todayIso(),
    expectedEndDate: '',
    status: ProjectStatus.ACTIVE,
    siteSupervisorId: null,
    budget: {},
    reason: '',
  };
}

function formFromProject(project: Project): FormState {
  const budget: BudgetDraft = {};
  for (const category of BUDGET_CATEGORIES) {
    const value = project.budget?.[category];
    if (typeof value === 'number') budget[category] = String(value);
  }
  return {
    name: project.name,
    location: project.location,
    startDate: project.startDate,
    expectedEndDate: project.expectedEndDate,
    status: project.status,
    siteSupervisorId: project.siteSupervisorId,
    budget,
    reason: '',
  };
}

export default function OwnerProjects() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [projectsRes, usersRes] = await Promise.all([
      apiFetch<Project[]>('/projects'),
      apiFetch<SupervisorOption[]>('/users?role=site_supervisor'),
    ]);
    if (projectsRes.success && projectsRes.data) setProjects(projectsRes.data);
    if (usersRes.success && usersRes.data) {
      setSupervisors(usersRes.data.filter((u) => u.isActive));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const budgetTotal = useMemo(
    () =>
      BUDGET_CATEGORIES.reduce((sum, category) => {
        const parsed = Number(form.budget[category]);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0),
    [form.budget]
  );

  const openCreate = () => {
    setEditingProject(null);
    setForm(emptyForm());
    setFormError(null);
    setModalVisible(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setForm(formFromProject(project));
    setFormError(null);
    setModalVisible(true);
  };

  const budgetChanged = useMemo(() => {
    if (!editingProject) return false;
    return BUDGET_CATEGORIES.some((category) => {
      const original = editingProject.budget?.[category];
      const draft = Number(form.budget[category]);
      const draftValue = Number.isFinite(draft) && form.budget[category] !== '' ? draft : undefined;
      return (original ?? undefined) !== draftValue;
    });
  }, [editingProject, form.budget]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim()) {
      setFormError('Name and location are required.');
      return;
    }
    if (!isValidDateInput(form.startDate) || !isValidDateInput(form.expectedEndDate)) {
      setFormError('Dates must be in YYYY-MM-DD format.');
      return;
    }
    if (form.expectedEndDate < form.startDate) {
      setFormError('The end date cannot be before the start date.');
      return;
    }

    const budget: Record<string, number> = {};
    for (const category of BUDGET_CATEGORIES) {
      const raw = form.budget[category];
      if (raw === undefined || raw === '') continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError(`${humanize(category)} budget must be a positive number.`);
        return;
      }
      budget[category] = parsed;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      startDate: form.startDate,
      expectedEndDate: form.expectedEndDate,
      status: form.status,
      siteSupervisorId: form.siteSupervisorId,
      budget,
      ...(editingProject && budgetChanged && form.reason.trim()
        ? { reason: form.reason.trim() }
        : {}),
    };

    const result = editingProject
      ? await apiFetch<Project>(`/projects/${editingProject._id}`, {
          method: 'PATCH',
          body: payload,
        })
      : await apiFetch<Project>('/projects', { method: 'POST', body: payload });

    setSaving(false);

    if (result.success) {
      setModalVisible(false);
      fetchData();
      if (!editingProject) {
        Alert.alert(
          'Project created',
          'Assign teams to this site from the project cost view.',
          [{ text: 'OK' }]
        );
      }
    } else {
      setFormError(result.error?.message || 'Could not save the project.');
    }
  };

  const setBudgetValue = (category: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      budget: { ...prev.budget, [category]: value.replace(/[^0-9.]/g, '') },
    }));
  };

  if (loading && projects.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading projects…</Text>
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
            tintColor={colors.role.owner}
          />
        }
      >
        {projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏗️</Text>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Add a site with its timeline and budget breakdown to start tracking costs.
            </Text>
          </View>
        ) : (
          projects.map((project) => (
            <View key={project._id} style={cardStyles.card}>
              <View style={cardStyles.header}>
                <View style={cardStyles.headerLeft}>
                  <Text style={cardStyles.name}>{project.name}</Text>
                  <Text style={cardStyles.location}>📍 {project.location}</Text>
                </View>
                <View
                  style={[
                    cardStyles.statusChip,
                    { backgroundColor: statusBackground(project.status) },
                  ]}
                >
                  <Text style={[cardStyles.statusText, { color: statusForeground(project.status) }]}>
                    {humanize(project.status)}
                  </Text>
                </View>
              </View>

              <Text style={cardStyles.timeline}>
                {formatDate(project.startDate)} → {formatDate(project.expectedEndDate)}
              </Text>

              <View style={cardStyles.budgetRow}>
                <Text style={cardStyles.budgetLabel}>Budget</Text>
                <Text style={cardStyles.budgetValue}>
                  {formatMoney(sumBudget(project.budget))}
                </Text>
              </View>

              {project.budgetHistory?.length > 0 && (
                <Text style={cardStyles.historyNote}>
                  {project.budgetHistory.length} budget change
                  {project.budgetHistory.length === 1 ? '' : 's'} · last{' '}
                  {formatDate(project.budgetHistory[project.budgetHistory.length - 1].changedAt)}
                </Text>
              )}

              <View style={cardStyles.actionRow}>
                <TouchableOpacity style={cardStyles.actionButton} onPress={() => openEdit(project)}>
                  <Text style={cardStyles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[cardStyles.actionButton, cardStyles.actionButtonPrimary]}
                  onPress={() =>
                    router.push({
                      pathname: '/(owner)/project-detail',
                      params: { projectId: project._id },
                    })
                  }
                >
                  <Text style={[cardStyles.actionText, cardStyles.actionTextPrimary]}>
                    Costs & teams
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ New Project</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.sheet}>
            <Text style={modalStyles.title}>
              {editingProject ? 'Edit Project' : 'New Project'}
            </Text>

            <ScrollView style={modalStyles.scroll} keyboardShouldPersistTaps="handled">
              <Input
                label="Project name"
                required
                value={form.name}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                placeholder="e.g. Gulberg Tower"
              />
              <Input
                label="Location"
                required
                value={form.location}
                onChangeText={(location) => setForm((prev) => ({ ...prev, location }))}
                placeholder="e.g. Block C, Gulberg III, Lahore"
              />
              <Input
                label="Start date (YYYY-MM-DD)"
                required
                value={form.startDate}
                onChangeText={(startDate) => setForm((prev) => ({ ...prev, startDate }))}
                placeholder="2026-08-01"
                autoCapitalize="none"
              />
              <Input
                label="Expected end date (YYYY-MM-DD)"
                required
                value={form.expectedEndDate}
                onChangeText={(expectedEndDate) =>
                  setForm((prev) => ({ ...prev, expectedEndDate }))
                }
                placeholder="2027-03-31"
                autoCapitalize="none"
              />

              <Text style={modalStyles.label}>Status</Text>
              <View style={modalStyles.chipRow}>
                {STATUS_OPTIONS.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      modalStyles.chip,
                      form.status === status && modalStyles.chipSelected,
                    ]}
                    onPress={() => setForm((prev) => ({ ...prev, status }))}
                  >
                    <Text
                      style={[
                        modalStyles.chipText,
                        form.status === status && modalStyles.chipTextSelected,
                      ]}
                    >
                      {humanize(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={modalStyles.label}>Site supervisor</Text>
              <View style={modalStyles.chipRow}>
                <TouchableOpacity
                  style={[
                    modalStyles.chip,
                    form.siteSupervisorId === null && modalStyles.chipSelected,
                  ]}
                  onPress={() => setForm((prev) => ({ ...prev, siteSupervisorId: null }))}
                >
                  <Text
                    style={[
                      modalStyles.chipText,
                      form.siteSupervisorId === null && modalStyles.chipTextSelected,
                    ]}
                  >
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {supervisors.map((supervisor) => (
                  <TouchableOpacity
                    key={supervisor.id}
                    style={[
                      modalStyles.chip,
                      form.siteSupervisorId === supervisor.id && modalStyles.chipSelected,
                    ]}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, siteSupervisorId: supervisor.id }))
                    }
                  >
                    <Text
                      style={[
                        modalStyles.chipText,
                        form.siteSupervisorId === supervisor.id && modalStyles.chipTextSelected,
                      ]}
                    >
                      {supervisor.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {supervisors.length === 0 && (
                <Text style={modalStyles.hint}>
                  No active site supervisors yet — create one in Settings → Manage Users.
                </Text>
              )}

              <Text style={modalStyles.label}>Budget breakdown (PKR)</Text>
              {BUDGET_CATEGORIES.map((category) => (
                <Input
                  key={category}
                  label={humanize(category)}
                  value={form.budget[category] ?? ''}
                  onChangeText={(value) => setBudgetValue(category, value)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              ))}

              <View style={modalStyles.totalRow}>
                <Text style={modalStyles.totalLabel}>Total budget</Text>
                <Text style={modalStyles.totalValue}>{formatMoney(budgetTotal)}</Text>
              </View>

              {editingProject && budgetChanged && (
                <>
                  <Text style={modalStyles.hint}>
                    Budget changes are recorded in this project's change history.
                  </Text>
                  <Input
                    label="Reason for budget change"
                    value={form.reason}
                    onChangeText={(reason) => setForm((prev) => ({ ...prev, reason }))}
                    placeholder="e.g. Client approved extra floor"
                  />
                </>
              )}

              {formError && <Text style={modalStyles.error}>{formError}</Text>}
            </ScrollView>

            <View style={modalStyles.buttonRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setModalVisible(false)}
                style={modalStyles.flexButton}
              />
              <Button
                title={editingProject ? 'Save changes' : 'Create project'}
                onPress={handleSave}
                loading={saving}
                style={modalStyles.flexButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function sumBudget(budget: Partial<Record<BudgetCategory, number>> | undefined): number {
  if (!budget) return 0;
  return BUDGET_CATEGORIES.reduce((sum, category) => {
    const value = budget[category];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

function statusBackground(status: ProjectStatus): string {
  if (status === ProjectStatus.ACTIVE) return colors.success.light;
  if (status === ProjectStatus.ON_HOLD) return colors.warning.light;
  return colors.neutral[100];
}

function statusForeground(status: ProjectStatus): string {
  if (status === ProjectStatus.ACTIVE) return colors.success.dark;
  if (status === ProjectStatus.ON_HOLD) return colors.warning.dark;
  return colors.text.tertiary;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  content: { padding: spacing.lg, paddingBottom: spacing['6xl'] },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: colors.role.owner,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: borderRadius.full,
    ...shadows.lg,
  },
  fabText: { ...typography.button, color: colors.text.inverse },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  name: { ...typography.heading4, color: colors.text.primary },
  location: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  statusChip: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  statusText: { ...typography.caption, fontWeight: '600' },
  timeline: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing.md },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  budgetLabel: { ...typography.caption, color: colors.text.tertiary },
  budgetValue: { ...typography.heading4, color: colors.text.primary },
  historyNote: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xs },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.input,
    alignItems: 'center',
  },
  actionButtonPrimary: { backgroundColor: colors.primary[50] },
  actionText: { ...typography.label, color: colors.text.secondary },
  actionTextPrimary: { color: colors.primary[700] },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.background.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
    maxHeight: '92%',
  },
  scroll: { marginBottom: spacing.md },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.lg },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.input,
  },
  chipSelected: { backgroundColor: colors.role.owner },
  chipText: { ...typography.bodySmall, color: colors.text.secondary },
  chipTextSelected: { color: colors.text.inverse, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.lg },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  totalLabel: { ...typography.label, color: colors.primary[700] },
  totalValue: { ...typography.heading4, color: colors.primary[700] },
  error: {
    ...typography.bodySmall,
    color: colors.danger.dark,
    backgroundColor: colors.danger.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
});
