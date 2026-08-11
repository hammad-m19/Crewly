import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius } from '../../theme/spacing';

interface ProgressBarProps {
  /** 0–100. Values above 100 render as a full over-budget bar. */
  percent: number | null;
  color?: string;
  height?: number;
  trackColor?: string;
}

/**
 * Budget vs. actual bar. Colors shift from green to amber to red as the
 * allocation is consumed, so overspend is visible without reading numbers.
 */
export default function ProgressBar({
  percent,
  color,
  height = 8,
  trackColor = colors.neutral[200],
}: ProgressBarProps) {
  const safePercent = percent === null || Number.isNaN(percent) ? 0 : Math.max(0, percent);
  const fillColor = color ?? statusColor(safePercent);

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${Math.min(safePercent, 100)}%`,
          height,
          backgroundColor: fillColor,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function statusColor(percent: number): string {
  if (percent > 100) return colors.danger.main;
  if (percent >= 85) return colors.warning.main;
  return colors.success.main;
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: borderRadius.full,
  },
});
