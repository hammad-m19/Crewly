import { NotificationsFeed, NotificationItem } from '../../components/NotificationsFeed';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';

export default function SiteNotificationsScreen() {
  const router = useRouter();

  const onNavigate = (notification: NotificationItem) => {
    switch (notification.type) {
      case 'team_assigned':
        router.push('/(site)/daily-report');
        break;
      case 'material_overdue':
        router.push('/(site)/materials');
        break;
      default:
        break;
    }
  };

  return (
    <NotificationsFeed
      accentColor={colors.role.site_supervisor}
      onNavigate={onNavigate}
    />
  );
}
