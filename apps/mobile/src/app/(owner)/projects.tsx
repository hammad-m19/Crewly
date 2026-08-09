import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export default function OwnerProjects() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🏗️</Text>
        <Text style={styles.emptyTitle}>Projects</Text>
        <Text style={styles.emptySubtitle}>
          Create and manage your construction projects here.
          {'\n'}Budget, team assignments, and progress tracking.
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => Alert.alert('Coming Soon', 'Project creation will be available in Phase 6.')}
        >
          <Text style={styles.createButtonText}>+ Create Project</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  createButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    borderRadius: borderRadius.md,
  },
  createButtonText: { ...typography.button, color: colors.text.inverse },
});
