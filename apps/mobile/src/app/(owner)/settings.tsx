import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';

export default function OwnerSettings() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Owner</Text>
        </View>
      </View>

      {/* Settings Options */}
      <View style={styles.section}>
        <SettingItem
          label="Manage Users"
          emoji="👥"
          onPress={() => router.push('/(owner)/users')}
        />
        <SettingItem
          label="Alerts"
          emoji="🔔"
          onPress={() => router.push('/(owner)/notifications' as any)}
        />
        <SettingItem
          label="Notification Preferences"
          emoji="⚙️"
          onPress={() => router.push('/(owner)/notification-prefs')}
        />
        <SettingItem label="App Version" emoji="ℹ️" value="1.0.0" />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingItem({
  label,
  emoji,
  value,
  onPress,
}: {
  label: string;
  emoji: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={settingStyles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={settingStyles.emoji}>{emoji}</Text>
      <Text style={settingStyles.label}>{label}</Text>
      {value ? (
        <Text style={settingStyles.value}>{value}</Text>
      ) : onPress ? (
        <Text style={settingStyles.arrow}>›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary, padding: spacing.lg },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
    ...shadows.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.role.owner,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { ...typography.heading2, color: colors.text.inverse },
  userName: { ...typography.heading3, color: colors.text.primary },
  userEmail: { ...typography.bodySmall, color: colors.text.tertiary, marginTop: spacing.xxs },
  roleBadge: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  roleBadgeText: { ...typography.label, color: colors.primary[700] },
  section: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing['2xl'],
    ...shadows.sm,
  },
  logoutButton: {
    backgroundColor: colors.danger.light,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  logoutButtonText: { ...typography.button, color: colors.danger.dark },
});

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  emoji: { fontSize: 20, marginRight: spacing.md },
  label: { ...typography.body, color: colors.text.primary, flex: 1 },
  value: { ...typography.bodySmall, color: colors.text.tertiary },
  arrow: { ...typography.heading3, color: colors.neutral[400] },
});
