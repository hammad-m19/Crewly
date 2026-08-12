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
  Modal,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { MorningPresence, Trade } from '@crewly/shared';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

const ON_SITE = MorningPresence?.ON_SITE ?? 'on_site';
const NOT_ON_SITE = MorningPresence?.NOT_ON_SITE ?? 'not_on_site';
const NOT_NEEDED = MorningPresence?.NOT_NEEDED ?? 'not_needed';

const TRADE_OPTIONS = Object.values(Trade);

type CheckInRow = {
  teamId: string;
  teamName: string;
  trade: string;
  contactPhone?: string;
  projectId: string;
  projectName: string;
  morningPresence: string | null;
  morningHeadcount: string;
  morningNotes: string;
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

/**
 * Morning roll-call — who is on site, absent, or not needed today.
 * Site Supervisors can also create a new team for this site when someone
 * is missing or an extra crew shows up.
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
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamTrade, setNewTeamTrade] = useState<string>(Trade.OTHER);
  const [newTeamPhone, setNewTeamPhone] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

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
          (p: any) =>
            toIdString(p._id) === resolvedProjectId || toIdString(p.id) === resolvedProjectId
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
    } catch {
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

  const handleCreateTeam = async () => {
    if (!projectId) return;
    if (!newTeamName.trim()) {
      Alert.alert('Missing name', 'Enter a team name.');
      return;
    }

    setCreatingTeam(true);
    try {
      const result = await apiFetch<any>('/teams', {
        method: 'POST',
        body: {
          name: newTeamName.trim(),
          trade: newTeamTrade,
          contactPhone: newTeamPhone.trim() || undefined,
          projectId,
          defaultPaymentType: 'daily_wage',
        },
      });

      if (!result.success) {
        Alert.alert('Could not create team', result.error?.message || 'Try again.');
        return;
      }

      setShowAddTeam(false);
      setNewTeamName('');
      setNewTeamPhone('');
      setNewTeamTrade(Trade.OTHER);
      await load();
      Alert.alert('Team added', `${newTeamName.trim()} is now on this site — mark them in the check-in.`);
    } catch {
      Alert.alert('Error', 'Could not reach the server.');
    } finally {
      setCreatingTeam(false);
    }
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

      const absentCount = rows.filter((r) => r.morningPresence === NOT_ON_SITE).length;
      const notNeededCount = rows.filter((r) => r.morningPresence === NOT_NEEDED).length;

      setSavedAt(new Date().toISOString());
      const parts: string[] = [];
      if (absentCount > 0) {
        parts.push(
          `${absentCount} not on site — Owner/Super were notified so you can call or add a replacement team.`
        );
      }
      if (notNeededCount > 0) {
        parts.push(`${notNeededCount} marked not needed today.`);
      }
      Alert.alert(
        'Morning check-in saved',
        parts.length > 0 ? parts.join(' ') : 'All required teams are on site.'
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

  if (!projectId) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No site assigned"
          message="Ask the Owner to assign you to a project first."
        />
      </View>
    );
  }

  const onSiteCount = rows.filter((r) => r.morningPresence === ON_SITE).length;
  const absentCount = rows.filter((r) => r.morningPresence === NOT_ON_SITE).length;
  const notNeededCount = rows.filter((r) => r.morningPresence === NOT_NEEDED).length;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.headerCard}>
          <Text style={styles.dateText}>{todayLabel}</Text>
          <Text style={styles.siteName}>{projectName || 'Your site'}</Text>
          <Text style={styles.hint}>
            Mark who is here now. Use Not needed if a team is not required today. You can add a
            replacement team yourself if someone is missing.
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryOn}>On site: {onSiteCount}</Text>
            <Text style={styles.summaryOff}>Not here: {absentCount}</Text>
            <Text style={styles.summarySkip}>Not needed: {notNeededCount}</Text>
          </View>
          {savedAt ? (
            <Text style={styles.savedAt}>
              Last saved{' '}
              {new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.addTeamBtn} onPress={() => setShowAddTeam(true)}>
          <Text style={styles.addTeamBtnText}>＋ Add team to this site</Text>
        </TouchableOpacity>

        {rows.length === 0 ? (
          <EmptyState
            title="No teams on this site yet"
            message="Add a team with the button above — Site Supervisors can create teams for their site."
          />
        ) : (
          rows.map((row) => (
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
                <TouchableOpacity
                  style={[
                    styles.presenceBtn,
                    row.morningPresence === NOT_NEEDED && styles.presenceSkip,
                  ]}
                  onPress={() =>
                    updateRow(row.teamId, {
                      morningPresence: NOT_NEEDED,
                      morningHeadcount: '',
                      morningNotes: '',
                    })
                  }
                >
                  <Text
                    style={[
                      styles.presenceText,
                      row.morningPresence === NOT_NEEDED && styles.presenceTextActive,
                    ]}
                  >
                    ➖ Not needed
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
                    placeholder="e.g. Lead delayed — adding replacement team"
                    placeholderTextColor={colors.neutral[400]}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.inlineAdd}
                    onPress={() => setShowAddTeam(true)}
                  >
                    <Text style={styles.inlineAddText}>＋ Add replacement team</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}

        {rows.length > 0 ? (
          <Button
            title="Save morning check-in"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            fullWidth
            style={styles.saveBtn}
          />
        ) : null}
      </ScrollView>

      <Modal visible={showAddTeam} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add team to this site</Text>
            <Text style={styles.modalHint}>
              Create a new team and assign it here — useful when someone is missing or an extra
              crew shows up.
            </Text>

            <Text style={styles.label}>Team name</Text>
            <TextInput
              style={styles.input}
              value={newTeamName}
              onChangeText={setNewTeamName}
              placeholder="e.g. Hassan Electric Crew"
              placeholderTextColor={colors.neutral[400]}
              autoFocus
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Trade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tradeRow}>
              {TRADE_OPTIONS.map((trade) => (
                <TouchableOpacity
                  key={trade}
                  style={[styles.tradeChip, newTeamTrade === trade && styles.tradeChipActive]}
                  onPress={() => setNewTeamTrade(trade)}
                >
                  <Text
                    style={[
                      styles.tradeChipText,
                      newTeamTrade === trade && styles.tradeChipTextActive,
                    ]}
                  >
                    {trade.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Contact phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={newTeamPhone}
              onChangeText={setNewTeamPhone}
              placeholder="+92…"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowAddTeam(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create team"
                onPress={handleCreateTeam}
                loading={creatingTeam}
                disabled={creatingTeam}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  headerCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  dateText: { ...typography.heading4, color: colors.text.primary },
  siteName: { ...typography.body, color: colors.text.secondary, marginTop: spacing.xxs },
  hint: { ...typography.bodySmall, color: colors.text.tertiary, marginTop: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  summaryOn: { ...typography.label, color: colors.success.dark },
  summaryOff: { ...typography.label, color: colors.danger.dark },
  summarySkip: { ...typography.label, color: colors.neutral[600] },
  savedAt: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm },
  addTeamBtn: {
    borderWidth: 1,
    borderColor: colors.role.site_supervisor,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.accent[50],
  },
  addTeamBtnText: {
    ...typography.label,
    color: colors.role.site_supervisor,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  teamName: { ...typography.heading4, color: colors.text.primary },
  trade: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
    textTransform: 'capitalize',
  },
  presenceRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  presenceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
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
  presenceSkip: {
    borderColor: colors.neutral[500],
    backgroundColor: colors.neutral[100],
  },
  presenceText: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
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
  inlineAdd: { marginTop: spacing.sm },
  inlineAddText: { ...typography.label, color: colors.role.site_supervisor },
  saveBtn: { marginTop: spacing.lg },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.background.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },
  modalTitle: { ...typography.heading3, color: colors.text.primary },
  modalHint: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  tradeRow: { flexGrow: 0, marginBottom: spacing.xs },
  tradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing.sm,
  },
  tradeChipActive: { backgroundColor: colors.role.site_supervisor },
  tradeChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  tradeChipTextActive: { color: colors.text.inverse, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing['2xl'] },
});
