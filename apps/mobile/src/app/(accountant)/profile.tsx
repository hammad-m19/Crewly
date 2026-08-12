import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import ProfileScreen from '../../components/ProfileScreen';

export default function AccountantProfile() {
  const router = useRouter();

  return (
    <ProfileScreen
      roleLabel="Accountant"
      roleColor={colors.role.accountant}
      extraLinks={[
        {
          label: 'Alerts',
          emoji: '🔔',
          onPress: () => router.push('/(accountant)/notifications' as any),
        },
      ]}
    />
  );
}
