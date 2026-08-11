import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { NotificationType } from '@crewly/shared';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';

type Preferences = Partial<Record<NotificationType, boolean>>;

interface PreferenceItem {
  type: NotificationType;
  label: string;
  description: string;
}

const GROUPS: { title: string; items: PreferenceItem[] }[] = [
  {
    title: 'Site issues',
    items: [
      {
        type: NotificationType.IDLE_TEAM,
        label: 'Idle teams',
        description: 'A team on site is unable to work',
      },
      {
        type: NotificationType.NO_SHOW,
        label: 'No-shows',
        description: "A team didn't turn up for the day",
      },
      {
        type: NotificationType.MATERIAL_OVERDUE,
        label: 'Overdue materials',
        description: 'A delivery has passed its expected date',
      },
    ],
  },
  {
    title: 'Escalations',
    items: [
      {
        type: NotificationType.ESCALATION_IDLE,
        label: 'Unresolved idle teams',
        description: 'An idle team has gone unresolved for 24 hours',
      },
      {
        type: NotificationType.ESCALATION_NO_SHOW,
        label: 'Unresolved no-shows',
        description: 'A no-show has gone unresolved for 24 hours',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        type: NotificationType.TEAM_ASSIGNED,
        label: 'Team assignments',
        description: 'A team is assigned to one of your sites',
      },
      {
        type: NotificationType.PETTY_CASH_RECONCILE,
        label: 'Petty cash reconciliation',
        description: "A supervisor's float is waiting to be reconciled",
      },
      {
        type: NotificationType.OTHER,
        label: 'Other updates',
        description: 'General notifications that don\u2019t fit the categories above',
      },
    ],
  },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);

  const fetchPrefs = useCallback(async () => {
    const result = await apiFetch<Preferences>('/users/me/notification-prefs');
    if (result.success && result.data) {
      setPrefs(result.data);
      setError(null);
    } else {
      setError(result.error?.message || 'Could not load your preferences.');
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const togglePref = async (type: NotificationType, enabled: boolean) => {
    if (!prefs) return;

    // Optimistic — the switch should respond instantly, then reconcile.
    const previous = prefs;
    setPrefs({ ...prefs, [type]: enabled });
    setSavingType(type);

    const result = await apiFetch<Preferences>('/users/me/notification-prefs', {
      method: 'PATCH',
      body: { preferences: { [type]: enabled } },
    });

    setSavingType(null);

    if (result.success && result.data) {
      setPrefs(result.data);
      setError(null);
    } else {
      setPrefs(previous);
      setError(result.error?.message || 'Could not save that change.');
    }
  };

  if (!prefs) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={error ? styles.errorText : styles.loadingText}>
          {error || 'Loading preferences…'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Choose which alerts reach you. Turning one off stops both in-app and push notifications for
        that category.
      </Text>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {GROUPS.map((group) => (
        <View key={group.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <View style={styles.card}>
            {group.items.map((item, index) => (
              <View
                key={item.type}
                style={[rowStyles.row, index === 0 && rowStyles.firstRow]}
              >
                <View style={rowStyles.labelArea}>
                  <Text style={rowStyles.label}>{item.label}</Text>
                  <Text style={rowStyles.description}>{item.description}</Text>
                </View>
                <Switch
                  value={prefs[item.type] !== false}
                  onValueChange={(enabled) => togglePref(item.type, enabled)}
                  disabled={savingType === item.type}
                  trackColor={{ true: colors.role.owner, false: colors.neutral[300] }}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  errorText: { ...typography.body, color: colors.danger.dark, textAlign: 'center' },
  intro: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing.xl,
  },
  errorBanner: {
    backgroundColor: colors.danger.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.danger.dark, textAlign: 'center' },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  firstRow: { borderTopWidth: 0 },
  labelArea: { flex: 1, paddingRight: spacing.lg },
  label: { ...typography.body, color: colors.text.primary },
  description: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
});
