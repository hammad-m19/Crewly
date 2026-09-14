import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

type Task = {
  _id?: string;
  id?: string;
  description: string;
  isCompleted: boolean;
  projectId: string;
  teamId: string;
  createdBy: string;
  createdAt: string;
};

type CheckInRow = {
  teamId: string;
  teamName: string;
  trade: string;
};

function toIdString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$oid === 'string') return obj.$oid;
    if (typeof (obj as { toHexString?: () => string }).toHexString === 'function') {
      return (obj as { toHexString: () => string }).toHexString();
    }
    if (typeof obj._id === 'string') return toIdString(obj._id);
  }
  const asString = String(value);
  if (/^[a-f\d]{24}$/i.test(asString)) return asString;
  return null;
}

export default function TeamTasksScreen() {
  const user = useAuthStore((s) => s.user);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  
  const [teams, setTeams] = useState<CheckInRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newTaskInput, setNewTaskInput] = useState<{ [teamId: string]: string }>({});
  const [creatingTask, setCreatingTask] = useState<string | null>(null); // teamId

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const siteIds = (user?.assignedSites || [])
        .map((s) => toIdString(s))
        .filter((id): id is string => !!id);

      let resolvedProjectId = siteIds[0] || null;
      let resolvedProjectName = '';

      const projectsRes = await apiFetch<Array<{ _id: string; id?: string; name: string }>>(
        '/projects'
      );

      if (!projectsRes.success) {
        setError(projectsRes.error?.message || 'Could not load projects.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const projects = projectsRes.data || [];

      if (!resolvedProjectId && projects.length) {
        resolvedProjectId =
          toIdString((projects[0] as any)._id) || toIdString((projects[0] as any).id);
        resolvedProjectName = projects[0].name;
      } else if (resolvedProjectId) {
        const match = projects.find(
          (p: any) =>
            toIdString(p._id) === resolvedProjectId || toIdString(p.id) === resolvedProjectId
        );
        resolvedProjectName = match?.name || 'Your site';
      }

      if (!resolvedProjectId) {
        setTeams([]);
        setTasks([]);
        setProjectId(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setProjectId(resolvedProjectId);
      setProjectName(resolvedProjectName);

      const [assignRes, tasksRes] = await Promise.all([
        apiFetch<any[]>(`/teams/assignments?projectId=${encodeURIComponent(resolvedProjectId)}`),
        apiFetch<Task[]>(`/tasks?projectId=${encodeURIComponent(resolvedProjectId)}`),
      ]);

      if (!assignRes.success || !tasksRes.success) {
        setError(assignRes.error?.message || tasksRes.error?.message || 'Could not load data.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const assignments = assignRes.data || [];
      const loadedTasks = tasksRes.data || [];

      const nextTeams: CheckInRow[] = assignments
        .map((a: any) => {
          const team = a.teamId;
          const teamId =
            typeof team === 'object'
              ? toIdString(team?._id) || toIdString(team)
              : toIdString(team);
          if (!teamId) return null;

          const teamName = typeof team === 'object' ? team.name || 'Team' : 'Team';
          const trade = typeof team === 'object' ? team.trade || '' : '';

          return {
            teamId,
            teamName,
            trade,
          } as CheckInRow;
        })
        .filter((r): r is CheckInRow => !!r);

      setTeams(nextTeams);
      setTasks(loadedTasks);
    } catch {
      setError('Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.assignedSites]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTask = async (teamId: string) => {
    const description = newTaskInput[teamId]?.trim();
    if (!description || !projectId) return;

    setCreatingTask(teamId);
    try {
      const res = await apiFetch<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ projectId, teamId, description }),
      });

      if (!res.success) {
        Alert.alert('Error', res.error?.message || 'Failed to add task');
        return;
      }

      setTasks((prev) => [res.data!, ...prev]);
      setNewTaskInput((prev) => ({ ...prev, [teamId]: '' }));
    } catch {
      Alert.alert('Error', 'Connection error');
    } finally {
      setCreatingTask(null);
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    setTasks((prev) =>
      prev.map((t) =>
        (t._id || t.id) === taskId ? { ...t, isCompleted: newCompleted } : t
      )
    );

    try {
      const res = await apiFetch<Task>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: newCompleted }),
      });

      if (!res.success) {
        Alert.alert('Error', res.error?.message || 'Failed to update task');
        // Revert
        setTasks((prev) =>
          prev.map((t) =>
            (t._id || t.id) === taskId ? { ...t, isCompleted: currentCompleted } : t
          )
        );
      }
    } catch {
      Alert.alert('Error', 'Connection error');
      // Revert
      setTasks((prev) =>
        prev.map((t) =>
          (t._id || t.id) === taskId ? { ...t, isCompleted: currentCompleted } : t
        )
      );
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
      </View>
    );
  }

  if (error && !teams.length) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={() => loadData()} />
      </View>
    );
  }

  if (!projectId) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No Site Assigned"
          message="You are not assigned to any active project."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.projectLabel}>Project</Text>
            <Text style={styles.projectTitle}>{projectName}</Text>
          </View>
        </View>

        {teams.length === 0 ? (
          <EmptyState title="No Teams Assigned" message="No teams are assigned to this project." />
        ) : (
          teams.map((team) => {
            const teamTasks = tasks.filter((t) => t.teamId === team.teamId);
            
            return (
              <View key={team.teamId} style={styles.teamCard}>
                <View style={styles.teamHeader}>
                  <Text style={styles.teamName}>{team.teamName}</Text>
                  <Text style={styles.teamTrade}>{team.trade}</Text>
                </View>

                {teamTasks.length > 0 ? (
                  <View style={styles.taskList}>
                    {teamTasks.map((task) => (
                      <TouchableOpacity
                        key={task._id || task.id}
                        style={styles.taskRow}
                        onPress={() => handleToggleTask((task._id || task.id)!, task.isCompleted)}
                      >
                        <View style={[styles.checkbox, task.isCompleted && styles.checkboxChecked]}>
                          {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text
                          style={[
                            styles.taskText,
                            task.isCompleted && styles.taskTextCompleted,
                          ]}
                        >
                          {task.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noTasks}>No tasks recorded yet.</Text>
                )}

                <View style={styles.addTaskRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="New task..."
                    placeholderTextColor={colors.neutral[400]}
                    value={newTaskInput[team.teamId] || ''}
                    onChangeText={(text) =>
                      setNewTaskInput((prev) => ({ ...prev, [team.teamId]: text }))
                    }
                    onSubmitEditing={() => handleAddTask(team.teamId)}
                  />
                  <Button
                    title="Add"
                    size="sm"
                    loading={creatingTask === team.teamId}
                    disabled={!newTaskInput[team.teamId]?.trim() || creatingTask === team.teamId}
                    onPress={() => handleAddTask(team.teamId)}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  projectLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  projectTitle: {
    ...typography.heading3,
    color: colors.neutral[900],
  },
  teamCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[300],
  },
  teamName: {
    ...typography.label,
    color: colors.neutral[900],
  },
  teamTrade: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  taskList: {
    marginVertical: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.success.main,
    borderColor: colors.success.main,
  },
  checkmark: {
    color: colors.background.card,
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskText: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
  taskTextCompleted: {
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  noTasks: {
    ...typography.body,
    color: colors.neutral[400],
    fontStyle: 'italic',
    marginVertical: spacing.sm,
  },
  addTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    height: 40,
    ...typography.body,
    color: colors.neutral[900],
  },
});
