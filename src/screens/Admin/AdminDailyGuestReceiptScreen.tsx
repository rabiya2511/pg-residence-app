import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import {
  properties,
  DAILY_GUEST_RATE,
  AdminDailyGuestPaymentMethod,
  PG_UPI_ID,
  PG_PAYEE_NAME,
} from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

function buildUpiLink(amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: PG_UPI_ID,
    pn: PG_PAYEE_NAME,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

export default function AdminDailyGuestReceiptScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { guestId } = route.params;
  const { dailyGuests, recordDailyGuestPayment, rooms } = useAdmin();

  const guest = dailyGuests.find((g) => g.id === guestId);

  const pendingAmount = guest ? Math.max(0, guest.totalAmount - (guest.advanceAmount ?? 0)) : 0;

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<AdminDailyGuestPaymentMethod | null>(null);

  if (!guest) return null;

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

  const property = properties.find((p) => p.id === guest.propertyId);
  const room = rooms.find((r) => r.id === guest.roomId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('AdminTabs')} style={styles.backButton}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Invoice</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.sm }]}>
              Day Guest Registered
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{guest.checkInDate}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Guest Name</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>{guest.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Phone</Text>
            <Text style={[typography.body, { color: colors.text }]}>{guest.phone}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Email</Text>
            <Text style={[typography.body, { color: colors.text }]}>{guest.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Property</Text>
            <Text style={[typography.body, { color: colors.text }]}>{property?.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Room</Text>
            <Text style={[typography.body, { color: colors.text }]}>
              {room?.roomNumber} ({room?.capacity} Sharing)
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Rate</Text>
            <Text style={[typography.body, { color: colors.text }]}>₹{DAILY_GUEST_RATE} / day</Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Joining Date</Text>
            <Text style={[typography.body, { color: colors.text }]}>{guest.checkInDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Vacating Date</Text>
            <Text style={[typography.body, { color: colors.text }]}>{guest.vacatingDate}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[typography.heading3, { color: colors.text }]}>Total Amount</Text>
            <Text style={[typography.heading2, { color: colors.primary }]}>
              ₹{guest.totalAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Advance Paid</Text>
            <Text style={[typography.bodyBold, { color: colors.success }]}>
              ₹{(guest.advanceAmount ?? 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Pending Balance</Text>
            <Text style={[typography.bodyBold, { color: pendingAmount > 0 ? colors.warning : colors.success }]}>
              ₹{pendingAmount.toLocaleString()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Status</Text>
            <Text
              style={[
                typography.bodyBold,
                { color: guest.paymentStatus === 'Paid' ? colors.success : colors.warning },
              ]}
            >
              {guest.paymentStatus}
              {guest.paymentMethod ? ` · ${guest.paymentMethod}` : ''}
            </Text>
          </View>
        </View>

        {pendingAmount > 0 && (
          <TouchableOpacity
            style={styles.markPaidButton}
            activeOpacity={0.85}
            onPress={openPaymentModal}
          >
            <Text style={[typography.button, { color: colors.white }]}>Record Payment</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminTabs')}
        >
          <Text style={[typography.button, { color: colors.white }]}>Done</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPaymentModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Record Payment
            </Text>

            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Amount (Pending: ₹{pendingAmount.toLocaleString()})
            </Text>
            <TextInput
              style={styles.amountInput}
              value={paymentAmountInput}
              onChangeText={setPaymentAmountInput}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Payment Method
            </Text>
            <View style={styles.methodRow}>
              {(['Cash', 'UPI'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodButton, selectedMethod === method && styles.methodButtonActive]}
                  onPress={() => setSelectedMethod(method)}
                >
                  <Text
                    style={[
                      typography.body,
                      { color: selectedMethod === method ? colors.white : colors.text },
                    ]}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedMethod === 'UPI' && enteredAmount > 0 && (
              <View style={styles.qrCard}>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                  Scan to pay ₹{enteredAmount.toLocaleString()}
                </Text>
                <QRCode
                  value={buildUpiLink(enteredAmount, `Payment for ${guest.name}`)}
                  size={180}
                />
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  {PG_UPI_ID}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (enteredAmount <= 0 || !selectedMethod) && styles.confirmButtonDisabled,
              ]}
              disabled={enteredAmount <= 0 || !selectedMethod}
              onPress={handleConfirmPayment}
            >
              <Text style={[typography.button, { color: colors.white }]}>
                Confirm ₹{enteredAmount.toLocaleString()} Received
              </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptHeader: { alignItems: 'center', marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  markPaidButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  amountInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  methodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  qrCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.md },
});