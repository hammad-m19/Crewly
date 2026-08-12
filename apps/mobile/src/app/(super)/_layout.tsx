import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useRoleTabScreenOptions } from '../../theme/navigation';

export default function SuperSupervisorLayout() {
  const screenOptions = useRoleTabScreenOptions(colors.role.super_supervisor);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="live-board" options={{
        title: 'Live Board',
        headerTitle: 'All Sites',
        tabBarIcon: ({ color }) => <TabIcon emoji="📡" color={color} />,
      }} />
      <Tabs.Screen name="coordinate" options={{
        title: 'Coordinate',
        tabBarIcon: ({ color }) => <TabIcon emoji="🔄" color={color} />,
      }} />
      <Tabs.Screen name="verify" options={{
        title: 'Verify',
        tabBarIcon: ({ color }) => <TabIcon emoji="✅" color={color} />,
      }} />
      <Tabs.Screen name="notifications" options={{
        title: 'Alerts',
        tabBarIcon: ({ color }) => <TabIcon emoji="🔔" color={color} />,
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
