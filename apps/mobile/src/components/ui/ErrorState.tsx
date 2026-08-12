import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import Button from './Button';

interface ErrorStateProps {
  message?: string;
  title?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button title="Try again" onPress={onRetry} variant="outline" size="sm" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
