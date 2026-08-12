import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permission and register the device FCM/APNs token
 * with the backend. Safe to call repeatedly; failures are logged and ignored
 * (permission denial, Expo Go limits, missing physical device, etc.).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device — skipping registration');
      return null;
    }

    // Expo Go on Android has limited/no remote push support in recent SDKs
    if (Constants.appOwnership === 'expo') {
      console.log(
        'Running in Expo Go — remote push may be limited. Continuing with best-effort registration.'
      );
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied — push registration skipped');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Prefer the native device token (FCM / APNs) for firebase-admin delivery
    let token: string | null = null;
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = typeof deviceToken.data === 'string' ? deviceToken.data : String(deviceToken.data);
    } catch (deviceErr) {
      console.warn(
        'getDevicePushTokenAsync failed (common in Expo Go) — falling back to Expo push token:',
        deviceErr
      );
      try {
        const projectId =
          Constants.easConfig?.projectId ??
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
            ?.projectId;
        const expoToken = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        token = expoToken.data;
      } catch (expoErr) {
        console.warn('Expo push token unavailable:', expoErr);
        return null;
      }
    }

    if (!token) return null;

    const result = await apiFetch('/users/me/fcm-token', {
      method: 'PATCH',
      body: { fcmToken: token },
    });

    if (!result.success) {
      console.warn('Failed to save FCM token:', result.error?.message);
      return null;
    }

    return token;
  } catch (error) {
    console.warn('Push notification registration error:', error);
    return null;
  }
}
