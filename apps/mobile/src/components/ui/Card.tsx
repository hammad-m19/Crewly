import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Left accent border color */
  accent?: string;
  style?: ViewStyle;
  padded?: boolean;
}

export default function Card({
  children,
  title,
  subtitle,
  accent,
  style,
  padded = true,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        accent && { borderLeftWidth: 4, borderLeftColor: accent },
        style,
      ]}
    >
      {(title || subtitle) && (
        <View style={[styles.header, padded && styles.headerPadded]}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      <View style={padded ? styles.contentPadded : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  headerPadded: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  contentPadded: {
    padding: spacing.lg,
  },
});
