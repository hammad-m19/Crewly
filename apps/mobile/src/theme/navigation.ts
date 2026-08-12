import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './colors';
import { typography } from './typography';

/** Height of the tab icons + labels, excluding the home-indicator inset. */
const TAB_BAR_CONTENT_HEIGHT = 52;

/**
 * Shared tab-bar + header options for role layouts.
 * Uses the device safe-area inset so tabs sit above the home indicator
 * instead of hugging the bottom edge of the screen.
 */
export function useRoleTabScreenOptions(roleColor: string) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return {
    headerStyle: { backgroundColor: roleColor },
    headerTintColor: colors.text.inverse,
    headerTitleStyle: typography.heading4,
    tabBarActiveTintColor: roleColor,
    tabBarInactiveTintColor: colors.neutral[400],
    tabBarStyle: {
      backgroundColor: colors.background.secondary,
      borderTopColor: colors.neutral[200],
      height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
      paddingBottom: bottomInset,
      paddingTop: 4,
    },
    tabBarLabelStyle: typography.caption,
  };
}
