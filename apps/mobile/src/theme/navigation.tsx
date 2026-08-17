import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/tabs';
import { colors } from './colors';
import { typography } from './typography';

/** Fallback when SafeAreaInsets reports 0 (common on some iOS simulators). */
const IOS_HOME_INDICATOR = 34;
const TAB_CONTENT_HEIGHT = 49;

function useBottomSafeInset() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return Math.max(insets.bottom, IOS_HOME_INDICATOR);
  }
  return Math.max(insets.bottom, 8);
}

function SafeTabBar(props: BottomTabBarProps) {
  const bottom = useBottomSafeInset();
  return (
    <BottomTabBar
      {...props}
      insets={{ ...props.insets, bottom }}
      style={[
        (props as any).style,
        {
          height: TAB_CONTENT_HEIGHT + bottom,
          paddingBottom: bottom,
          paddingTop: 4,
        },
      ]}
    />
  );
}

/**
 * Shared tab navigator props for every role.
 * Forces bottom inset so labels sit above the home indicator.
 */
export function useRoleTabNavigator(roleColor: string) {
  const insets = useSafeAreaInsets();
  const bottom = useBottomSafeInset();

  return {
    safeAreaInsets: {
      top: insets.top,
      bottom,
      left: Math.max(insets.left, 4),
      right: Math.max(insets.right, 4),
    },
    tabBar: (props: BottomTabBarProps) => <SafeTabBar {...props} />,
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
        height: TAB_CONTENT_HEIGHT + bottom,
        paddingBottom: bottom,
        paddingTop: 4,
      },
      tabBarLabelStyle: { ...typography.caption, fontSize: 10 },
      tabBarItemStyle: { paddingHorizontal: 2 },
    },
  };
}
