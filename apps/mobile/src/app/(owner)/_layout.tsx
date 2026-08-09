import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.role.owner },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: typography.heading4,
        tabBarActiveTintColor: colors.role.owner,
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopColor: colors.neutral[200],
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: typography.caption,
      }}
    >
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
