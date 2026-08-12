import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useRoleTabNavigator } from '../../theme/navigation';

export default function AccountantLayout() {
  const { safeAreaInsets, screenOptions, tabBar } = useRoleTabNavigator(colors.role.accountant);

  return (
    <Tabs safeAreaInsets={safeAreaInsets} screenOptions={screenOptions} tabBar={tabBar}>
      <Tabs.Screen name="payment-queue" options={{
        title: 'Payments',
        headerTitle: 'Payment Queue',
        tabBarIcon: ({ color }) => <TabIcon emoji="💳" color={color} />,
      }} />
      <Tabs.Screen name="purchases" options={{
        title: 'Purchases',
        tabBarIcon: ({ color }) => <TabIcon emoji="🧾" color={color} />,
      }} />
      <Tabs.Screen name="reconciliation" options={{
        title: 'Reconcile',
        tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} />,
      }} />
      <Tabs.Screen name="cost-reports" options={{
        title: 'Reports',
        tabBarIcon: ({ color }) => <TabIcon emoji="📈" color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        headerTitle: 'Profile',
        tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
      }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Alerts' }} />
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
