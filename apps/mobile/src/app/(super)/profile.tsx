import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import ProfileScreen from '../../components/ProfileScreen';

export default function SuperProfile() {
  const router = useRouter();

  return (
    <ProfileScreen
      roleLabel="Super Supervisor"
      roleColor={colors.role.super_supervisor}
      extraLinks={[
        {
          label: 'Alerts',
          emoji: '🔔',
          onPress: () => router.push('/(super)/notifications' as any),
        },
      ]}
    />
  );
}
