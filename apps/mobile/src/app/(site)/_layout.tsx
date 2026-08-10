import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useSyncStore } from '../../store/syncStore';

export default function SiteSupervisorLayout() {
  const pendingCount = useSyncStore((s) => s.pendingChangesCount);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.role.site_supervisor },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: typography.heading4,
        tabBarActiveTintColor: colors.role.site_supervisor,
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopColor: colors.neutral[200],
          height: 60, paddingBottom: 8, paddingTop: 4,
        },
        tabBarLabelStyle: typography.caption,
      }}
    >
      <Tabs.Screen name="daily-report" options={{
        title: 'Report',
        headerTitle: "Today's Report",
        tabBarIcon: ({ color }) => <TabIcon emoji="📝" color={color} />,
      }} />
      <Tabs.Screen name="materials" options={{
        title: 'Materials',
        tabBarIcon: ({ color }) => <TabIcon emoji="📦" color={color} />,
      }} />
      <Tabs.Screen name="petty-cash" options={{
        title: 'Petty Cash',
        tabBarIcon: ({ color }) => <TabIcon emoji="💰" color={color} />,
      }} />
      <Tabs.Screen name="sync-status" options={{
        title: 'Sync',
        tabBarIcon: ({ color }) => <TabIcon emoji="🔄" color={color} />,
        tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
      }} />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: any }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[tabStyles.icon, { opacity: color === colors.neutral[400] ? 0.5 : 1 }]}>
        {emoji}
      </Text>
    </View>
  );
}
const tabStyles = StyleSheet.create({
  iconContainer: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
});
