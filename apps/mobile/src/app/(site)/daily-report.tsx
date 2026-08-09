import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';

export default function DailyReport() {
  const { isOnline } = useSyncStore();
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Offline mode indicator */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📡 Working offline — changes will sync when connected
          </Text>
        </View>
      )}

      {/* Date Header */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{today}</Text>
        <View style={[styles.statusBadge, styles.draftBadge]}>
          <Text style={styles.draftBadgeText}>Not Started</Text>
        </View>
      </View>

      {/* Team Entries Placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Attendance & Tasks</Text>
        <Text style={styles.sectionSubtitle}>
          Each team assigned to your site will appear here.
          Log attendance, tasks worked on, and idle reasons.
        </Text>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => Alert.alert('Coming Soon', 'Team entry form will be available in Phase 2.')}
        >
          <Text style={styles.addButtonText}>+ Start Today's Report</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickAction emoji="📸" label="Add Photo" onPress={() => Alert.alert('Coming Soon')} />
        <QuickAction emoji="📦" label="Material Order" onPress={() => Alert.alert('Coming Soon')} />
        <QuickAction emoji="🧾" label="Log Purchase" onPress={() => Alert.alert('Coming Soon')} />
      </View>

      {/* Important Note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>💡 Remember</Text>
        <Text style={styles.noteText}>
          • All data saves locally first — works without internet{'\n'}
          • No-shows will immediately alert the Super Supervisor{'\n'}
          • Team idle? You must select a reason (required){'\n'}
          • Receipt photo required for all purchases
        </Text>
      </View>
    </ScrollView>
  );
}

function QuickAction({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={actionStyles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={actionStyles.emoji}>{emoji}</Text>
      <Text style={actionStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  offlineBanner: {
    backgroundColor: colors.sync.pending + '20',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.sync.pending + '40',
  },
  offlineText: { ...typography.bodySmall, color: colors.warning.dark, textAlign: 'center' },
  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  dateText: { ...typography.heading3, color: colors.text.primary },
  statusBadge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.full },
  draftBadge: { backgroundColor: colors.neutral[200] },
  draftBadgeText: { ...typography.caption, color: colors.neutral[600] },
  section: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    padding: spacing['2xl'], marginBottom: spacing['2xl'], ...shadows.sm,
  },
  sectionTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  sectionSubtitle: { ...typography.bodySmall, color: colors.text.tertiary, marginBottom: spacing.xl },
  addButton: {
    backgroundColor: colors.role.site_supervisor, paddingVertical: spacing.lg,
    borderRadius: borderRadius.md, alignItems: 'center',
  },
  addButtonText: { ...typography.button, color: colors.text.inverse },
  quickActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing['2xl'] },
  noteCard: {
    backgroundColor: colors.info.light, borderRadius: borderRadius.lg,
    padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.info.main,
  },
  noteTitle: { ...typography.heading4, color: colors.info.dark, marginBottom: spacing.sm },
  noteText: { ...typography.bodySmall, color: colors.info.dark, lineHeight: 22 },
});

const actionStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignItems: 'center', ...shadows.sm,
  },
  emoji: { fontSize: 28, marginBottom: spacing.sm },
  label: { ...typography.caption, color: colors.text.secondary },
});
