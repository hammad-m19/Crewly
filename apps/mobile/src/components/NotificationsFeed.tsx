import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { apiFetch } from '../lib/api';

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  projectId: string | null;
  metadata: string;
  read: boolean;
  created_at: number;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  no_show: '🚫',
  idle_team: '⚠️',
  material_overdue: '📦',
  escalation_idle: '🔴',
  escalation_no_show: '🔴',
  team_assigned: '👷',
  petty_cash_reconcile: '💰',
  other: '🔔',
};

export interface NotificationsFeedProps {
  /** Accent color for unread styling and pull-to-refresh tint */
  accentColor: string;
  /**
   * Optional deep-link handler. When omitted, tapping only marks the
   * notification as read.
   */
  onNavigate?: (notification: NotificationItem) => void;
}

/**
 * Shared in-app notification feed used by every role group.
 */
export function NotificationsFeed({ accentColor, onNavigate }: NotificationsFeedProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await apiFetch<NotificationItem[]>('/notifications');
      if (result.success) {
        setNotifications(result.data || []);
        setUnreadCount((result as { unreadCount?: number }).unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleMarkRead = async (notificationId: string) => {
    await apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleTapNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      void handleMarkRead(notification._id);
    }
    onNavigate?.(notification);
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.actionBar}>
          <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={[styles.markAllText, { color: accentColor }]}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchNotifications(true)}
            tintColor={accentColor}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>
              You'll be notified about idle teams, no-shows,
              {'\n'}and overdue material orders.
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification._id}
              style={[
                cardStyles.container,
                !notification.read && {
                  backgroundColor: colors.primary[50],
                  borderLeftWidth: 3,
                  borderLeftColor: accentColor,
                },
              ]}
              onPress={() => handleTapNotification(notification)}
              activeOpacity={0.7}
            >
              <View style={cardStyles.iconArea}>
                <Text style={cardStyles.icon}>
                  {NOTIFICATION_ICONS[notification.type] || '🔔'}
                </Text>
                {!notification.read && (
                  <View style={[cardStyles.unreadDot, { backgroundColor: accentColor }]} />
                )}
              </View>
              <View style={cardStyles.content}>
                <Text style={[cardStyles.title, !notification.read && cardStyles.titleUnread]}>
                  {notification.title}
                </Text>
                <Text style={cardStyles.message} numberOfLines={2}>
                  {notification.message}
                </Text>
                <Text style={cardStyles.time}>{formatTimeAgo(notification.created_at)}</Text>
              </View>
              <Text style={cardStyles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.background.secondary,
  },
  unreadLabel: { ...typography.label, color: colors.text.secondary },
  markAllText: { ...typography.label },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  iconArea: { marginRight: spacing.md, position: 'relative' },
  icon: { fontSize: 28 },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: colors.text.primary },
  titleUnread: { fontWeight: '700' },
  message: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  time: { ...typography.caption, color: colors.neutral[400], marginTop: spacing.xs },
  chevron: { ...typography.heading3, color: colors.neutral[300], marginLeft: spacing.sm },
});
