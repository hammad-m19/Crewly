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
import { MorningPresence } from '@crewly/shared';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

const ON_SITE = MorningPresence?.ON_SITE ?? 'on_site';
const NOT_ON_SITE = MorningPresence?.NOT_ON_SITE ?? 'not_on_site';

type AssignedTeam = {
  teamId: string;
  teamName: string;
  trade: string;
  contactPhone?: string;
  projectId: string;
  projectName: string;
};

type CheckInRow = AssignedTeam & {
  morningPresence: MorningPresence | null;
  morningHeadcount: string;
  morningNotes: string;
};

/** Normalize API ids that may arrive as string, ObjectId-like, or mangled buffer objects. */
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

/**
 * Morning roll-call — mark which assigned teams are physically on site
 * at the start of the day. Separate from end-of-day attendance on Report.
 */
export default function MorningCheckInScreen() {
  const user = useAuthStore((s) => s.user);
  const todayISO = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const [rows, setRows] = useState<CheckInRow[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
        return;
      }

      const projects = projectsRes.data || [];

      if (!resolvedProjectId && projects.length) {
        resolvedProjectId =
          toIdString((projects[0] as any)._id) || toIdString((projects[0] as any).id);
        resolvedProjectName = projects[0].name;
      } else if (resolvedProjectId) {
        const match = projects.find(
          (p: any) => toIdString(p._id) === resolvedProjectId || toIdString(p.id) === resolvedProjectId
        );
        resolvedProjectName = match?.name || 'Your site';
      }

      if (!resolvedProjectId) {
        setRows([]);
        setProjectId(null);
        setError(null);
        setLoading(false);
        return;
      }

      setProjectId(resolvedProjectId);
      setProjectName(resolvedProjectName);

      const [assignRes, reportRes] = await Promise.all([
        apiFetch<any[]>(`/teams/assignments?projectId=${encodeURIComponent(resolvedProjectId)}`),
        apiFetch<any[]>(
          `/daily-reports?projectId=${encodeURIComponent(resolvedProjectId)}&date=${todayISO}`
        ),
      ]);

      if (!assignRes.success) {
        setError(assignRes.error?.message || 'Could not load team assignments.');
        setLoading(false);
        return;
      }

      const assignments = assignRes.data || [];
      const report = reportRes.data?.[0];
      const morningByTeam = new Map<string, any>();
      for (const entry of report?.teamEntries || []) {
        const tid = toIdString(entry.teamId);
        if (tid) morningByTeam.set(tid, entry);
      }

      const nextRows: CheckInRow[] = assignments
        .map((a: any) => {
          const team = a.teamId;
          const teamId =
            typeof team === 'object'
              ? toIdString(team?._id) || toIdString(team)
              : toIdString(team);
          if (!teamId) return null;

          const teamName = typeof team === 'object' ? team.name || 'Team' : 'Team';
          const trade = typeof team === 'object' ? team.trade || '' : '';
          const existing = morningByTeam.get(teamId);

          return {
            teamId,
            teamName,
            trade,
            contactPhone: typeof team === 'object' ? team.contactPhone : undefined,
            projectId: resolvedProjectId!,
            projectName: resolvedProjectName,
            morningPresence: existing?.morningPresence || null,
            morningHeadcount:
              existing?.morningHeadcount != null && existing.morningHeadcount > 0
                ? String(existing.morningHeadcount)
                : '',
            morningNotes: existing?.morningNotes || '',
          } as CheckInRow;
        })
        .filter((r): r is CheckInRow => !!r);

      setRows(nextRows);
      if (report?.teamEntries?.some((e: any) => e.morningCheckedAt)) {
        setSavedAt(report.teamEntries.find((e: any) => e.morningCheckedAt)?.morningCheckedAt);
      }
    } catch (err) {
      setError('Could not load morning check-in. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user?.assignedSites, todayISO]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (teamId: string, updates: Partial<CheckInRow>) => {
    setRows((prev) => prev.map((r) => (r.teamId === teamId ? { ...r, ...updates } : r)));
  };

  const handleSave = async () => {
    if (!projectId) return;

    const unmarked = rows.filter((r) => !r.morningPresence);
    if (unmarked.length > 0) {
      Alert.alert(
        'Incomplete check-in',
        `Mark every team: ${unmarked.map((r) => r.teamName).join(', ')}`
      );
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch('/daily-reports/morning-checkin', {
        method: 'POST',
        body: {
          projectId,
          date: todayISO,
          entries: rows.map((r) => ({
            teamId: r.teamId,
            morningPresence: r.morningPresence,
            morningHeadcount:
              r.morningPresence === ON_SITE
                ? parseInt(r.morningHeadcount || '0', 10) || 0
                : 0,
            morningNotes:
              r.morningPresence === NOT_ON_SITE ? r.morningNotes.trim() : '',
          })),
        },
      });

      if (!result.success) {
        Alert.alert('Save failed', result.error?.message || 'Could not save check-in.');
        return;
      }

      const absentCount = rows.filter(
        (r) => r.morningPresence === NOT_ON_SITE
      ).length;

      setSavedAt(new Date().toISOString());
      Alert.alert(
        'Morning check-in saved',
        absentCount > 0
          ? `${absentCount} team(s) marked not on site. Owner and Super Supervisor were notified so they can call or assign a replacement.`
          : 'All teams are on site. You can still update this later if someone leaves.'
      );
    } catch {
      Alert.alert('Error', 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton rows={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!projectId || rows.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No teams on this site"
          message="Ask the Owner or Super Supervisor to assign teams to your site. Site Supervisors cannot create teams."
        />
      </View>
    );
  }

  const onSiteCount = rows.filter((r) => r.morningPresence === ON_SITE).length;
  const absentCount = rows.filter((r) => r.morningPresence === NOT_ON_SITE).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.dateText}>{todayLabel}</Text>
        <Text style={styles.siteName}>{projectName || 'Your site'}</Text>
        <Text style={styles.hint}>
          Mark who is physically here now. End-of-day attendance stays on the Report tab.
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryOn}>On site: {onSiteCount}</Text>
          <Text style={styles.summaryOff}>Not here: {absentCount}</Text>
        </View>
        {savedAt ? (
          <Text style={styles.savedAt}>
            Last saved {new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
        ) : null}
      </View>

      {rows.map((row) => (
        <View key={row.teamId} style={styles.card}>
          <Text style={styles.teamName}>{row.teamName}</Text>
          <Text style={styles.trade}>{row.trade.replace(/_/g, ' ')}</Text>

          <View style={styles.presenceRow}>
            <TouchableOpacity
              style={[
                styles.presenceBtn,
                row.morningPresence === ON_SITE && styles.presenceOn,
              ]}
              onPress={() =>
                updateRow(row.teamId, {
                  morningPresence: ON_SITE,
                  morningNotes: '',
                })
              }
            >
              <Text
                style={[
                  styles.presenceText,
                  row.morningPresence === ON_SITE && styles.presenceTextActive,
                ]}
              >
                ✅ On site
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.presenceBtn,
                row.morningPresence === NOT_ON_SITE && styles.presenceOff,
              ]}
              onPress={() =>
                updateRow(row.teamId, {
                  morningPresence: NOT_ON_SITE,
                  morningHeadcount: '',
                })
              }
            >
              <Text
                style={[
                  styles.presenceText,
                  row.morningPresence === NOT_ON_SITE && styles.presenceTextActive,
                ]}
              >
                🚫 Not here
              </Text>
            </TouchableOpacity>
          </View>

          {row.morningPresence === ON_SITE ? (
            <View style={styles.field}>
              <Text style={styles.label}>Headcount present</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={row.morningHeadcount}
                onChangeText={(text) =>
                  updateRow(row.teamId, { morningHeadcount: text.replace(/[^0-9]/g, '') })
                }
                placeholder="e.g. 4"
                placeholderTextColor={colors.neutral[400]}
              />
            </View>
          ) : null}

          {row.morningPresence === NOT_ON_SITE ? (
            <View style={styles.field}>
              <Text style={styles.label}>
                Why / who to call{row.contactPhone ? ` (${row.contactPhone})` : ''}
              </Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={row.morningNotes}
                onChangeText={(text) => updateRow(row.teamId, { morningNotes: text })}
                placeholder="e.g. Lead said delayed — call Asif"
                placeholderTextColor={colors.neutral[400]}
                multiline
              />
            </View>
          ) : null}
        </View>
      ))}

      <Button
        title="Save morning check-in"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        fullWidth
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  headerCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  dateText: { ...typography.heading4, color: colors.text.primary },
  siteName: { ...typography.body, color: colors.text.secondary, marginTop: spacing.xxs },
  hint: { ...typography.bodySmall, color: colors.text.tertiary, marginTop: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  summaryOn: { ...typography.label, color: colors.success.dark },
  summaryOff: { ...typography.label, color: colors.danger.dark },
  savedAt: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  teamName: { ...typography.heading4, color: colors.text.primary },
  trade: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs, textTransform: 'capitalize' },
  presenceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  presenceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background.input,
  },
  presenceOn: {
    borderColor: colors.success.main,
    backgroundColor: colors.success.light,
  },
  presenceOff: {
    borderColor: colors.danger.main,
    backgroundColor: colors.danger.light,
  },
  presenceText: { ...typography.label, color: colors.text.secondary },
  presenceTextActive: { color: colors.text.primary, fontWeight: '600' },
  field: { marginTop: spacing.md },
  label: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.input,
  },
  notes: { minHeight: 64, textAlignVertical: 'top' },
  saveBtn: { marginTop: spacing.lg },
});
