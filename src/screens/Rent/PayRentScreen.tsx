import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useRent } from '../../context/RentContext';
import { useAdmin } from '../../context/AdminContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useMyUpiPayments, useUpiSettings } from '../../hooks/useUpiPayments';
import { buildUpiUri, currentMonthLabel, fmtWhen, isValidUtr, sanitizeUtr } from '../../utils/upiPayments';

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

// Pay by UPI, then send the 12-digit reference to the admin. The rent only turns Paid
// after the admin checks the money arrived - nothing is marked Paid from this screen.
export default function PayRentScreen() {
  const navigation = useNavigation<any>();
  const { rentStatus } = useRent();
  const { residents } = useAdmin();
  const { residentId } = useMockAuth();
  const propertyId = residents.find((r) => r.id === residentId)?.propertyId;
  const { settings, loaded } = useUpiSettings(propertyId);
  const { submit } = useMyUpiPayments();

  const amountToPay = rentStatus.amount;
  const { grossAmount: gross, deduction, deductionReason: reason, pendingVerification, rejectedPayment } = rentStatus;
  const month = currentMonthLabel();

  const [utr, setUtr] = useState('');
  const [sending, setSending] = useState(false);

  const upiReady = !!settings.upiId;
  const uri = upiReady ? buildUpiUri(settings.upiId, settings.payeeName, amountToPay, `Rent ${month}`) : '';
  const canSend = isValidUtr(utr) && amountToPay > 0 && !sending;

  const openUpiApp = async () => {
    try {
      await Linking.openURL(uri);
    } catch {
      Alert.alert(
        'No UPI app found',
        `Open any UPI app on your phone and pay ${inr(amountToPay)} to ${settings.upiId}, then come back and enter the reference number.`
      );
    }
  };

  const send = () => {
    if (!canSend) return;
    Alert.alert(
      'Send for verification?',
      `You are saying you paid ${inr(amountToPay)} to ${settings.upiId}.\nUPI reference: ${utr}\n\nThe admin will check this against the bank statement.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            const res = await submit(month, amountToPay, utr);
            setSending(false);
            if (res.ok) {
              setUtr('');
              Alert.alert('Sent', 'Your payment is now under verification. You will see it as Paid once the admin confirms.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              Alert.alert('Not sent', res.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Pay Rent</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[typography.body, { color: colors.textMuted }]}>Amount to pay · {month}</Text>
        <Text style={[typography.heading1, { color: colors.text, marginTop: 4 }]}>{inr(amountToPay)}</Text>
        {deduction > 0 && (
          <View style={styles.deductionBox}>
            <View style={styles.deductionLine}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Monthly rent</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{inr(gross)}</Text>
            </View>
            <View style={styles.deductionLine}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Deduction</Text>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>−{inr(deduction)}</Text>
            </View>
            {!!reason && (
              <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic', marginTop: 2 }]}>{reason}</Text>
            )}
          </View>
        )}

        {rentStatus.isPaid ? (
          <View style={[styles.banner, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[typography.body, styles.bannerText, { color: colors.success }]}>
              This month's rent is already paid.
            </Text>
          </View>
        ) : pendingVerification ? (
          <View style={[styles.banner, { backgroundColor: '#FEF3C7', alignItems: 'flex-start' }]}>
            <Ionicons name="time-outline" size={20} color={colors.warning} />
            <View style={styles.bannerText}>
              <Text style={[typography.bodyBold, { color: colors.warning }]}>Payment under verification</Text>
              <Text style={[typography.caption, { color: colors.text, marginTop: 2 }]}>
                Reference {pendingVerification.upiRef} · sent {fmtWhen(pendingVerification.submittedAt)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                The admin will confirm it once the money shows in the bank. You don't need to pay again.
              </Text>
            </View>
          </View>
        ) : !loaded ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !upiReady ? (
          <View style={[styles.banner, { backgroundColor: '#FEE2E2', alignItems: 'flex-start' }]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={[typography.body, styles.bannerText, { color: colors.text }]}>
              Online payment is not set up for your PG yet. Please pay the admin directly and ask them to mark it as paid.
            </Text>
          </View>
        ) : (
          <>
            {!!rejectedPayment && (
              <View style={[styles.banner, { backgroundColor: '#FEE2E2', alignItems: 'flex-start' }]}>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <View style={styles.bannerText}>
                  <Text style={[typography.bodyBold, { color: colors.error }]}>Last payment was rejected</Text>
                  <Text style={[typography.caption, { color: colors.text, marginTop: 2 }]}>
                    Reference {rejectedPayment.upiRef}
                    {rejectedPayment.reviewNote ? ` · ${rejectedPayment.reviewNote}` : ''}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    Please check and send the correct reference below.
                  </Text>
                </View>
              </View>
            )}

            <Text style={[typography.heading3, styles.stepTitle]}>1. Pay by UPI</Text>
            <View style={styles.payCard}>
              <View style={{ alignItems: 'center' }}>
                <View style={styles.qrBox}>
                  <QRCode value={uri} size={170} />
                </View>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  Scan with any UPI app, or use the button below
                </Text>
              </View>
              <View style={styles.payeeRow}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Pay to</Text>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{settings.payeeName}</Text>
              </View>
              <View style={styles.payeeRow}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>UPI ID</Text>
                <Text style={[typography.bodyBold, { color: colors.primary }]} selectable>
                  {settings.upiId}
                </Text>
              </View>
              <TouchableOpacity style={styles.openApp} activeOpacity={0.85} onPress={openUpiApp}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.white} />
                <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>
                  Open UPI app · {inr(amountToPay)}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[typography.heading3, styles.stepTitle]}>2. Enter the UPI reference</Text>
            <TextInput
              style={[styles.input, utr.length > 0 && !isValidUtr(utr) && { borderColor: colors.error }]}
              placeholder="12-digit UPI reference (UTR)"
              placeholderTextColor={colors.textMuted}
              value={utr}
              onChangeText={(t) => setUtr(sanitizeUtr(t))}
              keyboardType="number-pad"
              maxLength={12}
            />
            <Text style={[typography.caption, { color: utr.length > 0 && !isValidUtr(utr) ? colors.error : colors.textMuted }]}>
              {utr.length > 0 && !isValidUtr(utr)
                ? `${utr.length}/12 digits`
                : 'Find it in your UPI app under the payment details ("UPI Ref No." or "UTR").'}
            </Text>
          </>
        )}
      </ScrollView>

      {!rentStatus.isPaid && !pendingVerification && upiReady && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.payButton, !canSend && styles.payButtonDisabled]}
            activeOpacity={0.85}
            onPress={send}
            disabled={!canSend}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.button, { color: colors.white }]}>I've paid · Send for verification</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  deductionBox: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.sm },
  deductionLine: { flexDirection: 'row', justifyContent: 'space-between' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  bannerText: { flex: 1, marginLeft: spacing.sm },
  stepTitle: { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  payCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  qrBox: { backgroundColor: '#FFFFFF', padding: spacing.sm, borderRadius: radius.md },
  payeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  openApp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  footer: { padding: spacing.md },
  payButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  payButtonDisabled: { opacity: 0.5 },
});