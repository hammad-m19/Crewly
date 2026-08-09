import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export default function PaymentQueue() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Payment Type Sections */}
      <PaymentSection
        emoji="👷"
        title="Daily Wages Due"
        subtitle="Computed from attendance data (headcount × daily rate)"
        count="—"
      />
      <PaymentSection
        emoji="🎯"
        title="Milestone Payments"
        subtitle="Tasks marked 'completed' in daily reports"
        count="—"
      />
      <PaymentSection
        emoji="📄"
        title="Lump-Sum Installments"
        subtitle="Scheduled payments against agreed totals"
        count="—"
      />
      <PaymentSection
        emoji="💰"
        title="Petty Cash Top-ups"
        subtitle="Float requests from Site Supervisors"
        count="—"
      />
    </ScrollView>
  );
}

function PaymentSection({
  emoji,
  title,
  subtitle,
  count,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  count: string;
}) {
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.emoji}>{emoji}</Text>
        <View style={sectionStyles.titleArea}>
          <Text style={sectionStyles.title}>{title}</Text>
          <Text style={sectionStyles.subtitle}>{subtitle}</Text>
        </View>
        <View style={sectionStyles.badge}>
          <Text style={sectionStyles.badgeText}>{count}</Text>
        </View>
      </View>
      <View style={sectionStyles.emptyRow}>
        <Text style={sectionStyles.emptyText}>No pending payments</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.lg,
    marginBottom: spacing.lg, ...shadows.sm, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  emoji: { fontSize: 28, marginRight: spacing.md },
  titleArea: { flex: 1 },
  title: { ...typography.heading4, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  badge: {
    backgroundColor: colors.neutral[200], borderRadius: borderRadius.full,
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { ...typography.label, color: colors.neutral[600] },
  emptyRow: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { ...typography.bodySmall, color: colors.text.tertiary },
});
