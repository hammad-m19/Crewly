import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/tabs';
import { colors } from './colors';
import { typography } from './typography';

/** iPhone home-indicator height when SafeArea reports 0 (common in the simulator). */
const IOS_HOME_INDICATOR = 34;

function useBottomSafeInset() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return Math.max(insets.bottom, IOS_HOME_INDICATOR);
  }
  return Math.max(insets.bottom, 8);
}

function SafeTabBar(props: BottomTabBarProps) {
  const bottom = useBottomSafeInset();
  return <BottomTabBar {...props} insets={{ ...props.insets, bottom }} />;
}

/**
 * Shared tab navigator props for every role.
 * Forces a real bottom inset so the tab bar sits above the home indicator.
 */
export function useRoleTabNavigator(roleColor: string) {
  const insets = useSafeAreaInsets();
  const bottom = useBottomSafeInset();

  return {
    safeAreaInsets: {
      top: insets.top,
      bottom,
      left: insets.left,
      right: insets.right,
    },
    screenOptions: {
      headerStyle: { backgroundColor: roleColor },
      headerTintColor: colors.text.inverse,
      headerTitleStyle: typography.heading4,
      headerShadowVisible: false,
      tabBarActiveTintColor: roleColor,
      tabBarInactiveTintColor: colors.neutral[400],
      tabBarStyle: {
        backgroundColor: colors.background.secondary,
        borderTopColor: colors.neutral[200],
      },
      tabBarLabelStyle: typography.caption,
      tabBar: (props: BottomTabBarProps) => <SafeTabBar {...props} />,
    },
  };
}
