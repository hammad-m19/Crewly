import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

export default function MaterialPurchaseScreen() {
  const { isOnline } = useSyncStore();
  const user = useAuthStore((s) => s.user);

  // Form State
  const [material, setMaterial] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock list (TODO: Pull from WatermelonDB)
  const [purchases, setPurchases] = useState([
    {
      id: '1',
      material: 'Nails and Screws',
      amount: 4500,
      date: new Date(Date.now() - 86400000).toISOString(),
      verified: true,
      flaggedLate: false,
      hasReceipt: true,
    },
    {
      id: '2',
      material: 'Paint Brushes',
      amount: 1200,
      date: new Date().toISOString(),
      verified: false,
      flaggedLate: false,
      hasReceipt: false,
    },
  ]);

  const handleCaptureReceipt = () => {
    // In Phase 2/3 completion, this will launch expo-image-picker
    Alert.alert('Coming soon', 'Camera integration for receipt capture.');
    setReceiptPhoto('mock_photo_uri.jpg');
  };

  const handleSubmit = () => {
    if (!material.trim() || !amount.trim()) {
      Alert.alert('Validation Error', 'Please enter material name and amount.');
      return;
    }

    if (isNaN(Number(amount))) {
      Alert.alert('Validation Error', 'Amount must be a valid number.');
      return;
    }

    setIsSubmitting(true);
    // Simulate save
    setTimeout(() => {
      setPurchases((prev) => [
        {
          id: Math.random().toString(),
          material,
          amount: Number(amount),
          date: new Date().toISOString(),
          verified: false,
          flaggedLate: false,
          hasReceipt: !!receiptPhoto,
        },
        ...prev,
      ]);
      setMaterial('');
      setAmount('');
      setNotes('');
      setReceiptPhoto(null);
      setIsSubmitting(false);

      Alert.alert(
        'Purchase Logged',
        `Expense logged locally.${isOnline ? ' Syncing...' : ' Will sync when online.'}`
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

      {/* New Purchase Form */}
      <Card title="Log Material Purchase" accent={colors.primary[500]} style={styles.formCard}>
        <Input
          label="Material / Item"
          placeholder="e.g. Nails, Paint, Tools"
          value={material}
          onChangeText={setMaterial}
          required
        />
        <Input
          label="Amount (PKR)"
          placeholder="e.g. 5000"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          required
        />
        <Input
          label="Notes (Optional)"
          placeholder="Where it was bought, why it was needed"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={styles.receiptSection}>
          <Text style={styles.fieldLabel}>Receipt Photo</Text>
          {receiptPhoto ? (
            <View style={styles.receiptAttached}>
              <Text style={styles.receiptText}>✅ Receipt Attached</Text>
              <TouchableOpacity onPress={() => setReceiptPhoto(null)}>
                <Text style={styles.removeReceipt}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoButton} onPress={handleCaptureReceipt}>
              <Text style={styles.photoButtonText}>📸 Capture Receipt</Text>
            </TouchableOpacity>
          )}
        </View>

        <Button
          title="Log Purchase"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />
      </Card>

      {/* Recent Purchases List */}
      <Text style={styles.sectionTitle}>Recent Purchases</Text>

      {purchases.map((purchase) => (
        <Card key={purchase.id} style={styles.purchaseCard} padded={false}>
          <View style={styles.purchaseHeader}>
            <View style={styles.purchaseLeft}>
              <Text style={styles.purchaseMaterial}>{purchase.material}</Text>
              <Text style={styles.purchaseDate}>
                {new Date(purchase.date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.purchaseRight}>
              <Text style={styles.purchaseAmount}>Rs {purchase.amount.toLocaleString()}</Text>
              <Badge
                label={purchase.verified ? 'Verified' : 'Pending'}
                variant={purchase.verified ? 'success' : 'neutral'}
              />
            </View>
          </View>
          
          {(!purchase.hasReceipt || purchase.flaggedLate) && (
            <View style={styles.purchaseFooter}>
              {!purchase.hasReceipt && (
                <Text style={styles.warningText}>⚠️ No receipt attached</Text>
              )}
              {purchase.flaggedLate && (
                <Text style={styles.dangerText}>🚨 Flagged as late entry</Text>
              )}
            </View>
          )}
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
  fieldLabel: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.sm },
  receiptSection: { marginBottom: spacing.xl },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    backgroundColor: colors.background.input,
  },
  photoButtonText: { ...typography.label, color: colors.text.tertiary },
  receiptAttached: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.success.light,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success.main + '40',
  },
  receiptText: { ...typography.body, color: colors.success.dark, fontWeight: '500' },
  removeReceipt: { ...typography.label, color: colors.danger.main },
  
  purchaseCard: { marginBottom: spacing.md },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  purchaseLeft: { flex: 1 },
  purchaseRight: { alignItems: 'flex-end', gap: spacing.xs },
  purchaseMaterial: { ...typography.heading4, color: colors.text.primary, marginBottom: spacing.xs },
  purchaseDate: { ...typography.bodySmall, color: colors.text.tertiary },
  purchaseAmount: { ...typography.heading3, color: colors.text.primary },
  purchaseFooter: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing.xs,
  },
  warningText: { ...typography.caption, color: colors.warning.dark },
  dangerText: { ...typography.caption, color: colors.danger.dark },
});
