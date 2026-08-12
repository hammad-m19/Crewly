import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Index route — immediately redirects based on auth state.
 * The actual routing logic is in _layout.tsx's navigation guard.
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Redirect to role-based dashboard
  switch (user.role) {
    case 'owner':
      return <Redirect href="/(owner)/dashboard" />;
    case 'super_supervisor':
      return <Redirect href="/(super)/live-board" />;
    case 'site_supervisor':
      return <Redirect href="/(site)/morning-checkin" />;
    case 'accountant':
      return <Redirect href="/(accountant)/payment-queue" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}
