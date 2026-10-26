import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminDailyGuestPaymentMethod, PG_UPI_ID, PG_PAYEE_NAME } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import { depositPaidOf, guestDue, guestRate } from '../../utils/dailyGuestHelpers';

const PAY_MODES: AdminDailyGuestPaymentMethod[] = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function buildUpiLink(amount: number, note: string): string {
  const params = new URLSearchParams({ pa: PG_UPI_ID, pn: PG_PAYEE_NAME, am: amount.toFixed(2), cu: 'INR', tn: note });
  return `upi://pay?${params.toString()}`;
}

function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: any }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.text, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md }, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function AdminDailyGuestReceiptScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { guestId } = route.params;
  const { dailyGuests, recordDailyGuestPayment, rooms, properties } = useAdmin();

  const guest = dailyGuests.find((g) => g.id === guestId);
  const due = guest ? guestDue(guest) : null;
  const pendingAmount = due ? due.total : 0;

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<AdminDailyGuestPaymentMethod | null>(null);

  if (!guest || !due) return null;

  const property = properties.find((p) => p.id === guest.propertyId);
  const room = rooms.find((r) => r.id === guest.roomId);
  const heldDeposit = depositPaidOf(guest);

  const openPaymentModal = () => {
    setPaymentAmountInput(String(pendingAmount));
    setSelectedMethod(null);
    setPaymentModalVisible(true);
  };

  const enteredAmount = Math.min(pendingAmount, Math.max(0, Number(paymentAmountInput) || 0));

  const handleConfirmPayment = () => {
    if (enteredAmount <= 0 || !selectedMethod) return;
    recordDailyGuestPayment(guest.id, enteredAmount, selectedMethod);
    setPaymentModalVisible(false);
  };

  // Go BACK to the existing Day Guests screen. (navigate() would push a second copy of it on top
  // of this invoice, so pressing back there would bring the invoice up again.)
  const goToStays = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('AdminDailyGuests');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToStays} style={styles.backButton}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Invoice</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Ionicons name={guest.checkedOut ? 'archive' : 'checkmark-circle'} size={40} color={guest.checkedOut ? colors.textMuted : colors.success} />
            <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.sm }]}>
              {guest.checkedOut ? 'Stay Completed' : 'Day Guest Registered'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{guest.checkInDate}</Text>
          </View>

          <View style={styles.divider} />

          <Row label="Guest Name" value={guest.name} valueStyle={typography.bodyBold} />
          <Row label="Phone" value={guest.phone} />
          {!!guest.email && <Row label="Email" value={guest.email} />}
          {!!guest.emergencyContact && <Row label="Emergency Contact" value={guest.emergencyContact} />}
          <Row label="Property" value={property?.name ?? '—'} />
          <Row
            label="Room"
            value={`${room?.roomNumber ?? '—'} (${room?.capacity ?? '—'} Sharing)${guest.bedNumber ? ` · Bed ${guest.bedNumber}` : ''}`}
          />

          <View style={styles.divider} />

          <Row label="Rate" value={`${money(guestRate(guest))} / day`} />
          <Row label="Joining Date" value={guest.checkInDate} />
          <Row label="Vacating Date" value={guest.vacatingDate ?? '—'} />
          <Row label="Stay Length" value={`${guest.numDays} day${guest.numDays > 1 ? 's' : ''}${(guest.extendedDays ?? 0) > 0 ? ` (extended +${guest.extendedDays})` : ''}`} />
          {(guest.discount ?? 0) > 0 && <Row label="Discount Given" value={`-${money(guest.discount ?? 0)}`} />}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[typography.heading3, { color: colors.text }]}>Stay Total</Text>
            <Text style={[typography.heading2, { color: colors.primary }]}>{money(guest.totalAmount)}</Text>
          </View>
          <Row label="Advance Paid" value={money(guest.advanceAmount ?? 0)} valueStyle={{ color: colors.success, fontWeight: '700' }} />
          <Row
            label="Stay Balance"
            value={money(due.stayDue)}
            valueStyle={{ color: due.stayDue > 0 ? colors.warning : colors.success, fontWeight: '700' }}
          />

          {(guest.securityDeposit ?? 0) > 0 && (
            <>
              <View style={styles.divider} />
              <Row label="Security Deposit" value={money(guest.securityDeposit ?? 0)} />
              <Row label="Deposit Paid" value={money(heldDeposit)} valueStyle={{ color: colors.success, fontWeight: '700' }} />
              {due.depositDue > 0 && (
                <Row label="Deposit Balance" value={money(due.depositDue)} valueStyle={{ color: colors.warning, fontWeight: '700' }} />
              )}
              {guest.depositRefunded && (
                <Row label="Deposit Refunded" value={guest.depositRefundedOn ?? 'Yes'} valueStyle={{ color: colors.success, fontWeight: '700' }} />
              )}
            </>
          )}

          <View style={styles.divider} />
          <Row
            label="Payment Status"
            value={`${pendingAmount > 0 ? `${money(pendingAmount)} pending` : 'Paid in full'}${guest.paymentMethod ? ` · ${guest.paymentMethod}` : ''}`}
            valueStyle={{ color: pendingAmount > 0 ? colors.warning : colors.success, fontWeight: '700' }}
          />
          {!!guest.notes && <Row label="Notes" value={guest.notes} />}
        </View>

        {pendingAmount > 0 && !guest.checkedOut && (
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={openPaymentModal}>
            <Text style={[typography.button, { color: colors.white }]}>Record Payment</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.primaryButton, { marginTop: spacing.md }]} activeOpacity={0.85} onPress={goToStays}>
          <Text style={[typography.button, { color: colors.white }]}>Done</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPaymentModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>Record Payment</Text>

            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Amount (Pending: {money(pendingAmount)})
            </Text>
            <TextInput
              style={styles.amountInput}
              value={paymentAmountInput}
              onChangeText={setPaymentAmountInput}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>Payment Method</Text>
            <View style={styles.methodRow}>
              {PAY_MODES.map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodButton, selectedMethod === method && styles.methodButtonActive]}
                  onPress={() => setSelectedMethod(method)}
                >
                  <Text style={[typography.caption, { color: selectedMethod === method ? colors.white : colors.text, fontWeight: '700' }]}>{method}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedMethod === 'UPI' && enteredAmount > 0 && (
              <View style={styles.qrCard}>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Scan to pay {money(enteredAmount)}</Text>
                <QRCode value={buildUpiLink(enteredAmount, `Payment for ${guest.name}`)} size={180} />
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{PG_UPI_ID}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, (enteredAmount <= 0 || !selectedMethod) && { opacity: 0.5 }]}
              disabled={enteredAmount <= 0 || !selectedMethod}
              onPress={handleConfirmPayment}
            >
              <Text style={[typography.button, { color: colors.white }]}>Confirm {money(enteredAmount)} Received</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setPaymentModalVisible(false)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  receiptCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  receiptHeader: { alignItems: 'center', marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  amountInput: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 15 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  methodButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
  methodButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  qrCard: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  confirmButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.md },
});