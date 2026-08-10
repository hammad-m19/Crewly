import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { MaterialOrderStatus } from '@crewly/shared';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import StatusChip from '../../components/ui/StatusChip';

export default function MaterialOrderScreen() {
  const { isOnline } = useSyncStore();
  const user = useAuthStore((s) => s.user);

  // Form State
  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock list (TODO: Pull from WatermelonDB)
  const [orders, setOrders] = useState([
    {
      id: '1',
      material: 'Cement Bags (OPC)',
      quantity: '50',
      status: MaterialOrderStatus.ORDERED,
      requestedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '2',
      material: 'Bricks (Class A)',
      quantity: '5000',
      status: MaterialOrderStatus.NEEDED,
      requestedAt: new Date().toISOString(),
    },
  ]);

  const handleSubmit = () => {
    if (!material.trim() || !quantity.trim()) {
      Alert.alert('Validation Error', 'Please enter both material name and quantity.');
      return;
    }

    setIsSubmitting(true);
    // Simulate save
    setTimeout(() => {
      setOrders((prev) => [
        {
          id: Math.random().toString(),
          material,
          quantity,
          status: MaterialOrderStatus.NEEDED,
          requestedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMaterial('');
      setQuantity('');
      setNotes('');
      setIsSubmitting(false);

      Alert.alert(
        'Request Saved',
        `Material request saved.${isOnline ? ' Syncing...' : ' Will sync when online.'}`
      );
    }, 500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 Working offline — changes will sync later</Text>
        </View>
      )}

      {/* New Request Form */}
      <Card title="New Material Request" accent={colors.primary[500]} style={styles.formCard}>
        <Input
          label="Material Name"
          placeholder="e.g. Cement, Bricks, Steel"
          value={material}
          onChangeText={setMaterial}
          required
        />
        <Input
          label="Quantity (with unit)"
          placeholder="e.g. 50 bags, 2 tons"
          value={quantity}
          onChangeText={setQuantity}
          required
        />
        <Input
          label="Notes (Optional)"
          placeholder="Brand preference, urgency, etc."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <Button
          title="Submit Request"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />
      </Card>

      {/* Existing Orders Pipeline */}
      <Text style={styles.sectionTitle}>Active Requests Pipeline</Text>

      {orders.map((order) => (
        <Card key={order.id} style={styles.orderCard} padded={false}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderMaterial}>{order.material}</Text>
              <Text style={styles.orderQuantity}>Qty: {order.quantity}</Text>
            </View>
            <StatusChip status={order.status} />
          </View>
          <View style={styles.orderFooter}>
            <Text style={styles.orderDate}>
              Requested: {new Date(order.requestedAt).toLocaleDateString()}
            </Text>
            {order.status === MaterialOrderStatus.WAITING_DELIVERY && (
              <Button
                title="Mark Received"
                variant="outline"
                size="sm"
                onPress={() => Alert.alert('Coming soon', 'Will update status locally.')}
              />
            )}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: spacing['6xl'] },
  offlineBanner: {
    backgroundColor: colors.sync.pending + '20',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.sync.pending + '40',
  },
  offlineText: { ...typography.bodySmall, color: colors.warning.dark, textAlign: 'center' },
  formCard: { marginBottom: spacing['2xl'] },
  sectionTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.lg },
  orderCard: { marginBottom: spacing.md },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  orderMaterial: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  orderQuantity: { ...typography.body, color: colors.text.secondary },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral[50],
  },
  orderDate: { ...typography.caption, color: colors.text.tertiary },
});
