import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useRoleTabNavigator } from '../../theme/navigation';

export default function OwnerLayout() {
  const { safeAreaInsets, screenOptions } = useRoleTabNavigator(colors.role.owner);

  return (
    <Tabs safeAreaInsets={safeAreaInsets} screenOptions={screenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          headerTitle: 'Crewly',
          tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => <TabIcon emoji="🏗️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} />,
        }}
      />

      <Tabs.Screen
        name="project-detail"
        options={{ href: null, title: 'Project Costs' }}
      />
      <Tabs.Screen name="users" options={{ href: null, title: 'Manage Users' }} />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: 'Alerts' }}
      />
      <Tabs.Screen
        name="notification-prefs"
        options={{ href: null, title: 'Notification Preferences' }}
      />
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
