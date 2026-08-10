import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface StatusChipProps {
  status: string;
  /** Override the label text (defaults to formatted status value) */
  label?: string;
}

/**
 * Maps common status values to colors.
 * Handles attendance, sync, project, and material order statuses.
 */
const statusColorMap: Record<string, { bg: string; text: string; dot: string }> = {
  // Attendance
  on_time: { bg: colors.success.light, text: colors.success.dark, dot: colors.success.main },
  half_day: { bg: colors.warning.light, text: colors.warning.dark, dot: colors.warning.main },
  evening_shift: { bg: colors.info.light, text: colors.info.dark, dot: colors.info.main },
  no_show: { bg: colors.danger.light, text: colors.danger.dark, dot: colors.danger.main },

  // Sync
  synced: { bg: colors.success.light, text: colors.success.dark, dot: colors.sync.synced },
  pending: { bg: colors.warning.light, text: colors.warning.dark, dot: colors.sync.pending },
  conflict: { bg: colors.danger.light, text: colors.danger.dark, dot: colors.sync.conflict },

  // Project
  active: { bg: colors.success.light, text: colors.success.dark, dot: colors.success.main },
  completed: { bg: colors.info.light, text: colors.info.dark, dot: colors.info.main },
  on_hold: { bg: colors.warning.light, text: colors.warning.dark, dot: colors.warning.main },

  // Material order
  needed: { bg: colors.danger.light, text: colors.danger.dark, dot: colors.danger.main },
  ordered: { bg: colors.warning.light, text: colors.warning.dark, dot: colors.warning.main },
  waiting_delivery: { bg: colors.info.light, text: colors.info.dark, dot: colors.info.main },
  received_full: { bg: colors.success.light, text: colors.success.dark, dot: colors.success.main },
  received_partial: { bg: colors.warning.light, text: colors.warning.dark, dot: colors.warning.main },

  // Verification
  verified: { bg: colors.success.light, text: colors.success.dark, dot: colors.success.main },
  unverified: { bg: colors.neutral[200], text: colors.neutral[700], dot: colors.neutral[500] },
};

const defaultColors = { bg: colors.neutral[200], text: colors.neutral[700], dot: colors.neutral[500] };

/** Format snake_case status to Title Case */
function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function StatusChip({ status, label }: StatusChipProps) {
  const colorSet = statusColorMap[status] || defaultColors;
  const displayLabel = label || formatStatus(status);

  return (
    <View style={[styles.chip, { backgroundColor: colorSet.bg }]}>
      <View style={[styles.dot, { backgroundColor: colorSet.dot }]} />
      <Text style={[styles.text, { color: colorSet.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});
