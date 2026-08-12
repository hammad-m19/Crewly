import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useRoleTabScreenOptions } from '../../theme/navigation';
import { useSyncStore } from '../../store/syncStore';

export default function SiteSupervisorLayout() {
  const pendingCount = useSyncStore((s) => s.pendingChangesCount);
  const screenOptions = useRoleTabScreenOptions(colors.role.site_supervisor);

  return (
    <Tabs screenOptions={screenOptions}>
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
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        headerTitle: 'Profile',
        tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
      }} />
      {/* Reachable by navigation, not shown in the tab bar */}
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Alerts' }} />
      <Tabs.Screen name="material-order" options={{ href: null, title: 'New Order' }} />
      <Tabs.Screen name="material-purchase" options={{ href: null, title: 'New Purchase' }} />
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
