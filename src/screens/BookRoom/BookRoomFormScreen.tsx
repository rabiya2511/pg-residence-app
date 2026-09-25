import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import {
  properties,
  MONTHLY_RENT_BY_CAPACITY,
  DAILY_GUEST_RATE,
  AdminGender,
  PG_UPI_ID,
  PG_PAYEE_NAME,
} from '../../constants/mockData';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

export default function BookRoomFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId, roomId, stayType } = route.params as {
    propertyId: string;
    roomId: string;
    stayType: 'Monthly' | 'DayGuest';
  };
  const { rooms } = useAdmin();

  const property = properties.find((p) => p.id === propertyId);
  const room = rooms.find((r) => r.id === roomId);
  const today = new Date();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<AdminGender | null>(null);
  const [numDays, setNumDays] = useState('1');
  const [method, setMethod] = useState<'Cash' | 'UPI' | null>(null);

  const [joinDay, setJoinDay] = useState(String(today.getDate()).padStart(2, '0'));
  const [joinMonth, setJoinMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [joinYear, setJoinYear] = useState(String(today.getFullYear()));

  const monthlyRent = room ? MONTHLY_RENT_BY_CAPACITY[room.capacity] ?? 8500 : 8500;
  const [securityDeposit, setSecurityDeposit] = useState(String(monthlyRent));

  const days = Math.max(1, Number(numDays) || 1);
  const totalAmount = stayType === 'Monthly' ? monthlyRent : days * DAILY_GUEST_RATE;

  const joinDayNum = Number(joinDay);
  const joinMonthNum = Number(joinMonth);
  const joinYearNum = Number(joinYear);
  const isValidJoinDate =
    joinDay.length > 0 &&
    joinMonth.length > 0 &&
    joinYear.length === 4 &&
    joinDayNum >= 1 &&
    joinDayNum <= 31 &&
    joinMonthNum >= 1 &&
    joinMonthNum <= 12;

  const joinDateObj = isValidJoinDate ? new Date(joinYearNum, joinMonthNum - 1, joinDayNum) : null;
  const vacatingDateObj =
    stayType === 'DayGuest' && joinDateObj
      ? new Date(joinDateObj.getFullYear(), joinDateObj.getMonth(), joinDateObj.getDate() + days)
      : null;

  const handleConfirmBooking = () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !gender) {
      Alert.alert('Missing Information', 'Please fill in your name, phone, email, and gender.');
      return;
    }
    if (!joinDateObj) {
      Alert.alert('Invalid Joining Date', 'Please enter a valid joining date.');
      return;
    }
    if (stayType === 'Monthly' && (!securityDeposit.trim() || isNaN(Number(securityDeposit)) || Number(securityDeposit) < 0)) {
      Alert.alert('Invalid Deposit', 'Please enter a valid security deposit amount.');
      return;
    }
    if (!method) {
      Alert.alert('Select Payment Method', 'Please choose Cash or UPI to complete your booking.');
      return;
    }

    navigation.replace('ResidentRegistration', {
      propertyId,
      roomId,
      stayType,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gender,
      method,
      numDays: stayType === 'DayGuest' ? days : undefined,
      joiningDateISO: joinDateObj.toISOString(),
      securityDeposit: stayType === 'Monthly' ? Number(securityDeposit) : undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Book Your Bed</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{property?.name}</Text>
            <Text style={[typography.bodyBold, { color: colors.text, marginTop: 2 }]}>
              {room?.roomNumber} · {room?.capacity} Sharing
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {stayType === 'Monthly' ? 'Monthly Stay' : `Day Guest — ${days} day${days !== 1 ? 's' : ''}`}
            </Text>
          </View>

          <Field label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Rahul Singh" />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="e.g. rahul@example.com" keyboardType="email-address" />

          <Text style={[typography.caption, styles.label]}>Gender</Text>
          <View style={styles.toggleRow}>
            {(['Male', 'Female', 'Other'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.toggleButton, gender === g && styles.toggleButtonActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[typography.body, { color: gender === g ? colors.white : colors.text }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[typography.caption, styles.label]}>Joining Date</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={joinDay}
              onChangeText={setJoinDay}
              placeholder="DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={joinMonth}
              onChangeText={setJoinMonth}
              placeholder="MM"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.dateInputYear]}
              value={joinYear}
              onChangeText={setJoinYear}
              placeholder="YYYY"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          {stayType === 'DayGuest' && (
            <Field
              label="Number of Days"
              value={numDays}
              onChangeText={setNumDays}
              placeholder="e.g. 3"
              keyboardType="numeric"
            />
          )}

          {stayType === 'DayGuest' && vacatingDateObj && (
            <View style={styles.vacatingCard}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Vacating Date</Text>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{formatDate(vacatingDateObj)}</Text>
              </View>
            </View>
          )}

          {stayType === 'Monthly' && (
            <Field
              label="Security Deposit"
              value={securityDeposit}
              onChangeText={setSecurityDeposit}
              placeholder="e.g. 8500"
              keyboardType="numeric"
            />
          )}

          <View style={styles.amountCard}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {stayType === 'Monthly' ? 'First Month Rent' : `${days} day${days !== 1 ? 's' : ''} × ₹${DAILY_GUEST_RATE}/day`}
            </Text>
            <Text style={[typography.heading2, { color: colors.text, marginTop: 4 }]}>
              ₹{totalAmount.toLocaleString()}
            </Text>
          </View>

          <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Payment Method</Text>
          <View style={styles.toggleRow}>
            {(['Cash', 'UPI'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.toggleButton, method === m && styles.toggleButtonActive]}
                onPress={() => setMethod(m)}
              >
                <Text style={[typography.body, { color: method === m ? colors.white : colors.text }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {method === 'UPI' && (
            <View style={styles.qrCard}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Scan to pay ₹{totalAmount.toLocaleString()}
              </Text>
              <QRCode value={buildUpiLink(totalAmount, `Booking for ${name.trim() || 'New Resident'}`)} size={180} />
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                {PG_UPI_ID}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.confirmButton}
            activeOpacity={0.85}
            onPress={handleConfirmBooking}
          >
            <Text style={[typography.button, { color: colors.white }]}>
              {`Pay ₹${totalAmount.toLocaleString()} & Book Now`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
}) {
  return (
    <View style={styles.field}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateInput: { flex: 1, textAlign: 'center' },
  dateInputYear: { flex: 1.4, textAlign: 'center' },
  vacatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  amountCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});