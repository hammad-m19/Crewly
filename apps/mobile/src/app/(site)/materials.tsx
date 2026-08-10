import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export default function MaterialsHubScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Material Management</Text>
      <Text style={styles.subtitle}>
        Request new materials from the central office, or log cash purchases made on site.
      </Text>

      <TouchableOpacity
        style={[styles.card, { borderLeftColor: colors.primary[500] }]}
        onPress={() => router.push('/(site)/material-order')}
      >
        <Text style={styles.cardEmoji}>📦</Text>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Material Requests</Text>
          <Text style={styles.cardDesc}>Request materials from head office to be delivered to site.</Text>
        </View>
        <Text style={styles.cardArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { borderLeftColor: colors.success.main }]}
        onPress={() => router.push('/(site)/material-purchase')}
      >
        <Text style={styles.cardEmoji}>🧾</Text>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Log Cash Purchase</Text>
          <Text style={styles.cardDesc}>Log a material purchase made locally using petty cash.</Text>
        </View>
        <Text style={styles.cardArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing['2xl'],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  cardEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  cardArrow: {
    fontSize: 24,
    color: colors.neutral[400],
    marginLeft: spacing.md,
  },
});
