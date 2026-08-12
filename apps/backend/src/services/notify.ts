import mongoose from 'mongoose';
import {
  NotificationType,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@crewly/shared';
import { Notification, INotification } from '../models/Notification';
import { User } from '../models/User';
import { isFirebaseReady, sendFcmPush } from '../config/firebase';

export interface NotifyParams {
  recipientUserId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string | mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}

/**
 * Create an in-app Notification and (when configured) send an FCM push.
 *
 * Preference rules: missing keys default to ENABLED (DEFAULT_NOTIFICATION_PREFERENCES).
 * If the user has explicitly opted out of `type`, neither the in-app row nor
 * the push are created.
 *
 * FCM is best-effort: missing Firebase credentials or a missing device token
 * never throw — the in-app notification is still saved when prefs allow.
 */
export async function notify(params: NotifyParams): Promise<INotification | null> {
  const {
    recipientUserId,
    type,
    title,
    message,
    projectId = null,
    metadata = {},
  } = params;

  const user = await User.findById(recipientUserId)
    .select('fcmToken notificationPrefs isActive _deleted')
    .lean();

  if (!user || user._deleted || user.isActive === false) {
    return null;
  }

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(user.notificationPrefs || {}),
  };

  if (prefs[type] === false) {
    return null;
  }

  const notification = new Notification({
    recipientUserId,
    type,
    projectId: projectId || null,
    title,
    message,
    metadata: JSON.stringify(metadata),
  });
  await notification.save();

  if (isFirebaseReady() && user.fcmToken) {
    await sendFcmPush({
      token: user.fcmToken,
      title,
      body: message,
      data: {
        type,
        notificationId: notification._id.toString(),
        projectId: projectId ? String(projectId) : '',
      },
    });
  }

  return notification;
}

/**
 * Notify every active user with the given role.
 * Returns the number of notifications actually created (after pref filtering).
 */
export async function notifyRole(
  role: string,
  params: Omit<NotifyParams, 'recipientUserId'>
): Promise<number> {
  const users = await User.find({
    role,
    isActive: true,
    _deleted: false,
  })
    .select('_id')
    .lean();

  let created = 0;
  for (const user of users) {
    const result = await notify({
      ...params,
      recipientUserId: user._id,
    });
    if (result) created++;
  }
  return created;
}
