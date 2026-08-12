import { NotificationsFeed, NotificationItem } from '../../components/NotificationsFeed';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';

export default function AccountantNotificationsScreen() {
  const router = useRouter();

  const onNavigate = (notification: NotificationItem) => {
    switch (notification.type) {
      case 'petty_cash_reconcile':
        router.push('/(accountant)/reconciliation');
        break;
      default:
        break;
    }
  };

  return (
    <NotificationsFeed
      accentColor={colors.role.accountant}
      onNavigate={onNavigate}
    />
  );
}
