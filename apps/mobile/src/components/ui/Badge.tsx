import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: string; // emoji
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.success.light, text: colors.success.dark },
  warning: { bg: colors.warning.light, text: colors.warning.dark },
  danger: { bg: colors.danger.light, text: colors.danger.dark },
  info: { bg: colors.info.light, text: colors.info.dark },
  neutral: { bg: colors.neutral[200], text: colors.neutral[700] },
  primary: { bg: colors.primary[50], text: colors.primary[700] },
};

export default function Badge({ label, variant = 'neutral', icon, size = 'sm', style }: BadgeProps) {
  const colorSet = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: colorSet.bg }, sizeStyles[size], style]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.text, { color: colorSet.text }, size === 'md' && styles.textMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  icon: {
    fontSize: 12,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
  textMd: {
    ...typography.label,
  },
});

const sizeStyles = {
  sm: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
};
