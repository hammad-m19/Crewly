import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export default function MaterialsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📦</Text>
        <Text style={styles.emptyTitle}>Materials</Text>
        <Text style={styles.emptySubtitle}>
          Create material orders, track delivery status,{'\n'}and log purchases with receipt photos.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', padding: spacing.lg },
  emptyState: {
    alignItems: 'center', padding: spacing['3xl'], backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg, ...shadows.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.bodySmall, color: colors.text.tertiary, textAlign: 'center' },
});
