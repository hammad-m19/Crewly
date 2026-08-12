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
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { apiFetch } from '../../lib/api';
import { formatMoney, formatDate } from '../../lib/format';

interface PurchaseItem {
  purchaseId: string;
  projectId: string;
  projectName: string;
  purchasedByName: string;
  material: string;
  amount: number;
  date: string;
  notes: string;
  hasReceipt: boolean;
  flaggedLate: boolean;
  verified: boolean;
}

interface PurchasesData {
  counts: { total: number; missingReceipt: number; flaggedLate: number; unverified: number };
  purchases: PurchaseItem[];
}

type Filter = 'all' | 'missing_receipt' | 'late' | 'unverified';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'missing_receipt', label: 'No receipt' },
  { id: 'late', label: 'Late entry' },
  { id: 'unverified', label: 'Unverified' },
];

export default function Purchases() {
  const [data, setData] = useState<PurchasesData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPurchases = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const result = await apiFetch<PurchasesData>('/accountant/purchases');
    if (result.success && result.data) {
      setData(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error?.message || 'Could not load purchases.');
    }
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPurchases();
    }, [fetchPurchases])
  );

  const handleVerify = async (purchaseId: string) => {
    setVerifyingId(purchaseId);
    setActionError(null);
    const result = await apiFetch(`/material-purchases/${purchaseId}/verify`, { method: 'PATCH' });
    setVerifyingId(null);
    if (result.success) {
      fetchPurchases();
    } else {
      setActionError(result.error?.message || 'Could not verify that purchase.');
    }
  };

  if (!data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={loadError ? styles.errorText : styles.loadingText}>
          {loadError || 'Loading purchases…'}
        </Text>
      </View>
    );
  }

  const visible = data.purchases.filter((p) => {
    if (filter === 'missing_receipt') return !p.hasReceipt;
    if (filter === 'late') return p.flaggedLate;
    if (filter === 'unverified') return !p.verified;
    return true;
  });

  const countFor = (id: Filter): number => {
    if (id === 'missing_receipt') return data.counts.missingReceipt;
    if (id === 'late') return data.counts.flaggedLate;
    if (id === 'unverified') return data.counts.unverified;
    return data.counts.total;
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label} ({countFor(f.id)})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchPurchases(true)} />
        }
      >
        {actionError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{actionError}</Text>
          </View>
        )}

        {visible.length === 0 && (
          <Text style={styles.emptyText}>No purchases match this filter.</Text>
        )}

        {visible.map((purchase) => (
          <View key={purchase.purchaseId} style={cardStyles.card}>
            <View style={cardStyles.topRow}>
              <Text style={cardStyles.material} numberOfLines={1}>
                {purchase.material}
              </Text>
              <Text style={cardStyles.amount}>{formatMoney(purchase.amount)}</Text>
            </View>
            <Text style={cardStyles.meta}>
              {purchase.projectName} · {formatDate(purchase.date)} · by {purchase.purchasedByName}
            </Text>
            {purchase.notes ? <Text style={cardStyles.notes}>{purchase.notes}</Text> : null}

            <View style={cardStyles.bottomRow}>
              <View style={cardStyles.badges}>
                {!purchase.hasReceipt && <Flag label="No receipt" tone="danger" />}
                {purchase.flaggedLate && <Flag label="Late entry" tone="warning" />}
                {purchase.verified && <Flag label="Verified" tone="success" />}
              </View>
              {!purchase.verified && (
                <TouchableOpacity
                  style={cardStyles.verifyButton}
                  onPress={() => handleVerify(purchase.purchaseId)}
                  disabled={verifyingId === purchase.purchaseId}
                >
                  <Text style={cardStyles.verifyText}>
                    {verifyingId === purchase.purchaseId ? 'Verifying…' : 'Verify'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Flag({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'success' }) {
  const palette = colors[tone];
  return (
    <View style={[flagStyles.flag, { backgroundColor: palette.light }]}>
      <Text style={[flagStyles.text, { color: palette.dark }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  loadingText: { ...typography.body, color: colors.text.tertiary },
  errorText: { ...typography.body, color: colors.danger.dark, textAlign: 'center' },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
  errorBanner: {
    backgroundColor: colors.danger.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.danger.dark, textAlign: 'center' },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  filterChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[200],
  },
  filterChipActive: { backgroundColor: colors.role.accountant },
  filterText: { ...typography.caption, color: colors.text.secondary },
  filterTextActive: { color: colors.text.inverse, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  material: { ...typography.body, color: colors.text.primary, fontWeight: '600', flex: 1 },
  amount: { ...typography.body, color: colors.role.accountant, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xxs },
  notes: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.xs },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, flex: 1 },
  verifyButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.role.accountant,
  },
  verifyText: { ...typography.caption, color: colors.role.accountant, fontWeight: '600' },
});

const flagStyles = StyleSheet.create({
  flag: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  text: { ...typography.caption, fontWeight: '600' },
});
