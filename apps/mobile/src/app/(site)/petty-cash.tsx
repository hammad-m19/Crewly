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

export default function PettyCashScreen() {
  const { isOnline } = useSyncStore();
  const user = useAuthStore((s) => s.user);

  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock Petty Cash State (TODO: Pull from WatermelonDB)
  const [pettyCashState, setPettyCashState] = useState({
    floatTotal: 50000,
    expensesTotal: 15500,
    currentBalance: 34500,
    reconciled: false,
    expenses: [
      { id: '1', amount: 5000, description: 'Fuel for generator', date: new Date(Date.now() - 86400000).toISOString() },
      { id: '2', amount: 10500, description: 'Emergency local labor payment', date: new Date().toISOString() },
    ],
  });

  const handleCaptureReceipt = () => {
    Alert.alert('Coming soon', 'Camera integration for receipt capture.');
    setReceiptPhoto('mock_photo_uri.jpg');
  };

  const handleSubmit = () => {
    if (!amount.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please enter amount and description.');
      return;
    }

    const expenseAmount = Number(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      Alert.alert('Validation Error', 'Amount must be a valid positive number.');
      return;
    }

    if (expenseAmount > pettyCashState.currentBalance) {
      Alert.alert('Insufficient Balance', 'Expense amount exceeds your current petty cash balance.');
      return;
    }

    if (pettyCashState.reconciled) {
      Alert.alert('Batch Closed', 'This petty cash batch is already reconciled. Ask Accountant for a new float.');
      return;
    }

    setIsSubmitting(true);
    // Simulate save
    setTimeout(() => {
      setPettyCashState((prev) => ({
        ...prev,
        expensesTotal: prev.expensesTotal + expenseAmount,
        currentBalance: prev.currentBalance - expenseAmount,
        expenses: [
          {
            id: Math.random().toString(),
            amount: expenseAmount,
            description,
            date: new Date().toISOString(),
          },
          ...prev.expenses,
        ],
      }));

      setAmount('');
      setDescription('');
      setReceiptPhoto(null);
      setIsSubmitting(false);

      Alert.alert(
        'Expense Logged',
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

      {/* Balance Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current Balance</Text>
        <Text style={styles.summaryBalance}>Rs {pettyCashState.currentBalance.toLocaleString()}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Float</Text>
            <Text style={styles.summaryValue}>Rs {pettyCashState.floatTotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={styles.summaryValue}>Rs {pettyCashState.expensesTotal.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* New Expense Form */}
      <Card title="Log Cash Expense" accent={colors.primary[500]} style={styles.formCard}>
        <Input
          label="Amount (PKR)"
          placeholder="e.g. 1500"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          required
        />
        <Input
          label="Description"
          placeholder="What was this cash spent on?"
          value={description}
          onChangeText={setDescription}
          required
        />

        <View style={styles.receiptSection}>
          <Text style={styles.fieldLabel}>Receipt Photo (Recommended)</Text>
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
          title="Log Cash Expense"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || pettyCashState.reconciled}
          fullWidth
        />
      </Card>

      {/* Expense History */}
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>Expense History</Text>
        {pettyCashState.reconciled && <Badge label="Reconciled" variant="success" />}
      </View>

      {pettyCashState.expenses.map((expense) => (
        <Card key={expense.id} style={styles.expenseCard} padded={false}>
          <View style={styles.expenseRow}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseDesc}>{expense.description}</Text>
              <Text style={styles.expenseDate}>
                {new Date(expense.date).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.expenseAmount}>- Rs {expense.amount.toLocaleString()}</Text>
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
  
  summaryCard: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
    ...shadows.md,
    alignItems: 'center',
  },
  summaryTitle: { ...typography.label, color: colors.primary[100] },
  summaryBalance: { ...typography.heading1, color: colors.text.inverse, marginVertical: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primary[500],
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { ...typography.caption, color: colors.primary[100] },
  summaryValue: { ...typography.body, color: colors.text.inverse, fontWeight: '600', marginTop: spacing.xxs },

  formCard: { marginBottom: spacing['2xl'] },
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

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: { ...typography.heading3, color: colors.text.primary },
  
  expenseCard: { marginBottom: spacing.sm },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  expenseLeft: { flex: 1, paddingRight: spacing.md },
  expenseDesc: { ...typography.body, color: colors.text.primary, fontWeight: '500', marginBottom: spacing.xs },
  expenseDate: { ...typography.caption, color: colors.text.tertiary },
  expenseAmount: { ...typography.heading4, color: colors.danger.main },
});
