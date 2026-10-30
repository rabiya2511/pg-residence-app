import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { banks } from '../../constants/mockData';
import { useRent } from '../../context/RentContext';
import { usePaymentMethods } from '../../context/PaymentMethodsContext';

// UPI ID format used here: a 10-digit mobile number, then "@", then the bank handle in letters
// (for example 9999999999@ybl). Anything else typed is ignored as the person types.
function sanitizeUpiInput(text: string): string {
  const v = text.toLowerCase().replace(/[^0-9a-z@]/g, '');
  const run = (v.match(/^\d*/) ?? [''])[0];
  const digits = run.slice(0, 10);
  if (digits.length < 10) return digits; // letters / @ are not allowed until 10 digits are typed
  let rest = v.slice(run.length);
  if (!rest) return digits;
  if (rest[0] !== '@') rest = `@${rest}`; // letters typed straight after the number get the @ added
  return digits + '@' + rest.slice(1).replace(/[^a-z]/g, '').slice(0, 20);
}
const isValidUpi = (v: string) => /^\d{10}@[a-z]{2,20}$/.test(v.trim());

const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'card', label: 'Credit / Debit Card', icon: 'card-outline' },
  { id: 'netbanking', label: 'Net Banking', icon: 'business-outline' },
];

export default function PayRentScreen() {
  const navigation = useNavigation<any>();
  const { rentStatus, markRentAsPaid } = useRent();
  const { savedUpiIds, savedCards, addUpiId, addCard } = usePaymentMethods();
  // rentStatus.amount is already the amount after any deduction the admin entered on the Rent screen.
  const amountToPay = rentStatus.amount;
  const gross = rentStatus.grossAmount;
  const deduction = rentStatus.deduction;
  const reason = rentStatus.deductionReason;

  const [selected, setSelected] = useState('upi');
  const [processing, setProcessing] = useState(false);

  const [selectedUpiId, setSelectedUpiId] = useState<string | null>(null);
  const [showNewUpiForm, setShowNewUpiForm] = useState(savedUpiIds.length === 0);
  const [newUpiId, setNewUpiId] = useState('');

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showNewCardForm, setShowNewCardForm] = useState(savedCards.length === 0);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');

  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const canPay = (() => {
    if (selected === 'upi') {
      return showNewUpiForm ? isValidUpi(newUpiId) : !!selectedUpiId;
    }
    if (selected === 'card') {
      if (showNewCardForm) {
        return (
          cardNumber.replace(/\s/g, '').length >= 12 &&
          cardHolderName.trim().length > 0 &&
          expiryMonth.length === 2 &&
          expiryYear.length === 2 &&
          cvv.length >= 3
        );
      }
      return !!selectedCardId;
    }
    if (selected === 'netbanking') {
      return !!selectedBank;
    }
    return false;
  })();

  const handlePay = () => {
    if (!canPay) return;
    setProcessing(true);

    if (selected === 'upi' && showNewUpiForm) {
      addUpiId(newUpiId.trim());
    }
    if (selected === 'card' && showNewCardForm) {
      addCard(cardNumber.trim(), cardHolderName.trim(), expiryMonth, expiryYear);
    }

    setTimeout(() => {
      setProcessing(false);
      const record = markRentAsPaid(selected);
      navigation.replace('PaymentSuccess', {
        amount: record.amount,
        month: record.month,
        paidOn: record.paidOn,
        method: record.method,
        transactionId: record.transactionId,
      });
    }, 1500);
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[typography.body, { color: colors.textMuted }]}>Amount to pay</Text>
        <Text style={[typography.heading1, { color: colors.text, marginTop: 4 }]}>
          ₹{amountToPay}
        </Text>
        {deduction > 0 && (
          <View style={styles.deductionBox}>
            <View style={styles.deductionLine}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Monthly rent</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>₹{gross}</Text>
            </View>
            <View style={styles.deductionLine}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Deduction</Text>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>−₹{deduction}</Text>
            </View>
            {!!reason && (
              <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic', marginTop: 2 }]}>
                {reason}
              </Text>
            )}
          </View>
        )}

        <Text
          style={[
            typography.heading3,
            { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
          ]}
        >
          Select Payment Method
        </Text>

        {paymentMethods.map((method) => {
          const isSelected = selected === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodCard, isSelected && styles.methodCardSelected]}
              onPress={() => setSelected(method.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={method.icon as any}
                size={20}
                color={isSelected ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  typography.body,
                  { marginLeft: spacing.sm, color: isSelected ? colors.primary : colors.text, flex: 1 },
                ]}
              >
                {method.label}
              </Text>
              <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isSelected ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}

        {selected === 'upi' && (
          <View style={styles.subForm}>
            {savedUpiIds.map((upi) => (
              <TouchableOpacity
                key={upi.id}
                style={[
                  styles.savedItem,
                  selectedUpiId === upi.id && !showNewUpiForm && styles.savedItemSelected,
                ]}
                onPress={() => {
                  setSelectedUpiId(upi.id);
                  setShowNewUpiForm(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                <Text style={[typography.body, { marginLeft: spacing.sm, color: colors.text, flex: 1 }]}>
                  {upi.upiId}
                </Text>
                <Ionicons
                  name={selectedUpiId === upi.id && !showNewUpiForm ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addNewRow}
              onPress={() => setShowNewUpiForm(!showNewUpiForm)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[typography.body, { marginLeft: spacing.sm, color: colors.primary }]}>
                Add another UPI ID
              </Text>
            </TouchableOpacity>

            {showNewUpiForm && (
              <>
                <TextInput
                  style={[
                    styles.input,
                    newUpiId.length > 0 && !isValidUpi(newUpiId) && { borderColor: colors.error },
                  ]}
                  placeholder="9999999999@ybl"
                  placeholderTextColor={colors.textMuted}
                  value={newUpiId}
                  onChangeText={(t) => setNewUpiId(sanitizeUpiInput(t))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={31}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: newUpiId.length > 0 && !isValidUpi(newUpiId) ? colors.error : colors.textMuted, marginBottom: spacing.sm },
                  ]}
                >
                  {newUpiId.length > 0 && !isValidUpi(newUpiId)
                    ? newUpiId.replace(/\D/g, '').length < 10 || !newUpiId.includes('@')
                      ? `Enter your 10-digit mobile number first (${Math.min(10, (newUpiId.match(/^\d*/) ?? [''])[0].length)}/10), then @ and the bank name, e.g. 9999999999@ybl`
                      : 'Add the bank name after @, e.g. @ybl, @ibl, @okaxis'
                    : '10-digit mobile number, then @ and the bank name, e.g. 9999999999@ybl'}
                </Text>
              </>
            )}
          </View>
        )}

        {selected === 'card' && (
          <View style={styles.subForm}>
            {savedCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.savedItem,
                  selectedCardId === card.id && !showNewCardForm && styles.savedItemSelected,
                ]}
                onPress={() => {
                  setSelectedCardId(card.id);
                  setShowNewCardForm(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={18} color={colors.primary} />
                <Text style={[typography.body, { marginLeft: spacing.sm, color: colors.text, flex: 1 }]}>
                  {card.cardType} •••• {card.cardNumberLast4}
                </Text>
                <Ionicons
                  name={selectedCardId === card.id && !showNewCardForm ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addNewRow}
              onPress={() => setShowNewCardForm(!showNewCardForm)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[typography.body, { marginLeft: spacing.sm, color: colors.primary }]}>
                Add another card
              </Text>
            </TouchableOpacity>

            {showNewCardForm && (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Card Number"
                  placeholderTextColor={colors.textMuted}
                  value={cardNumber}
                  onChangeText={setCardNumber}
                  keyboardType="number-pad"
                  maxLength={19}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Cardholder Name"
                  placeholderTextColor={colors.textMuted}
                  value={cardHolderName}
                  onChangeText={setCardHolderName}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.inputThird]}
                    placeholder="MM"
                    placeholderTextColor={colors.textMuted}
                    value={expiryMonth}
                    onChangeText={setExpiryMonth}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TextInput
                    style={[styles.input, styles.inputThird]}
                    placeholder="YY"
                    placeholderTextColor={colors.textMuted}
                    value={expiryYear}
                    onChangeText={setExpiryYear}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TextInput
                    style={[styles.input, styles.inputThird]}
                    placeholder="CVV"
                    placeholderTextColor={colors.textMuted}
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="number-pad"
                    maxLength={3}
                    secureTextEntry
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {selected === 'netbanking' && (
          <View style={styles.subForm}>
            {banks.map((bank) => (
              <TouchableOpacity
                key={bank}
                style={[styles.savedItem, selectedBank === bank && styles.savedItemSelected]}
                onPress={() => setSelectedBank(bank)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={18} color={colors.primary} />
                <Text style={[typography.body, { marginLeft: spacing.sm, color: colors.text, flex: 1 }]}>
                  {bank}
                </Text>
                <Ionicons
                  name={selectedBank === bank ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, (!canPay || processing) && styles.payButtonDisabled]}
          activeOpacity={0.85}
          onPress={handlePay}
          disabled={!canPay || processing}
        >
          {processing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[typography.button, { color: colors.white }]}>
              Pay ₹{amountToPay}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  subForm: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  addNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputThird: {
    flex: 1,
  },
  footer: {
    padding: spacing.md,
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deductionBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  deductionLine: { flexDirection: 'row', justifyContent: 'space-between' },
  payButtonDisabled: {
    opacity: 0.5,
  },
});