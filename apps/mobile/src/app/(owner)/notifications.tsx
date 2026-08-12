import { NotificationsFeed, NotificationItem } from '../../components/NotificationsFeed';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';

export default function OwnerNotificationsScreen() {
  const router = useRouter();

  const onNavigate = (notification: NotificationItem) => {
    switch (notification.type) {
      case 'escalation_idle':
      case 'escalation_no_show':
      case 'no_show':
      case 'idle_team':
      case 'material_overdue':
        router.push('/(owner)/dashboard');
        break;
      default:
        break;
    }
  };

  return (
    <NotificationsFeed accentColor={colors.role.owner} onNavigate={onNavigate} />
  );
}
