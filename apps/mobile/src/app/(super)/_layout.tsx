import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function SuperSupervisorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.role.super_supervisor },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: typography.heading4,
        tabBarActiveTintColor: colors.role.super_supervisor,
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopColor: colors.neutral[200],
          height: 60, paddingBottom: 8, paddingTop: 4,
        },
        tabBarLabelStyle: typography.caption,
      }}
    >
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

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
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
