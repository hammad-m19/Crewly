import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface LoadingSkeletonProps {
  /** Number of skeleton rows to render */
  rows?: number;
  style?: ViewStyle;
}

/**
 * Lightweight placeholder blocks for initial load states.
 */
export default function LoadingSkeleton({ rows = 5, style }: LoadingSkeletonProps) {
  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            index === 0 && styles.barWide,
            index % 3 === 1 && styles.barShort,
            index % 3 === 2 && styles.barMedium,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  bar: {
    height: 16,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[200],
    width: '100%',
  },
  barWide: {
    height: 28,
    width: '55%',
    marginBottom: spacing.sm,
  },
  barShort: {
    width: '62%',
  },
  barMedium: {
    width: '84%',
    height: 72,
    marginBottom: spacing.sm,
  },
});
