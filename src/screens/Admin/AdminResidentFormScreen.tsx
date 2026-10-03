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
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';
import { AdminResident, AdminGender } from '../../constants/mockData';
import TermsAgreement from '../../components/TermsAgreement';

type DepositStatus = 'Paid' | 'Not Paid' | 'No Advance';
type VehicleType = 'Bicycle' | 'Two-Wheeler' | 'Four-Wheeler';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer'];
const VEHICLE_TYPES: VehicleType[] = ['Bicycle', 'Two-Wheeler', 'Four-Wheeler'];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Parses "24 Sep 2026" (dd MMM yyyy — matches formatDate's own output) back
// into a Date, so editing a resident pre-fills their real joining date
// instead of silently resetting it to today.
function parseDate(str: string): Date | null {
  const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return null;
  return new Date(Number(m[3]), monthIdx, Number(m[1]));
}

// 5 -> "05th", 1 -> "01st", 22 -> "22nd"
function ordinalDay(day: number): string {
  const mod100 = day % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${String(day).padStart(2, '0')}${suffix}`;
}

// Accepts typed values like "12000", "12,000" or "₹12000" — anything that is
// not a digit or decimal point is ignored, so the summary never falls to 0
// just because of formatting.
const toNum = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};
const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function SelectField({
  label,
  valueLabel,
  placeholder,
  options,
  onSelect,
  disabled,
  containerStyle,
}: {
  label: string;
  valueLabel: string | undefined;
  placeholder: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  containerStyle?: any;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.selectInput, disabled && styles.selectDisabled]}
        activeOpacity={0.7}
        onPress={() => !disabled && setModalVisible(true)}
      >
        <Text style={[typography.body, { color: valueLabel ? colors.text : colors.textMuted }]}>
          {valueLabel || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            {options.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted, padding: spacing.md }]}>
                No options available
              </Text>
            ) : (
              options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.modalOption}
                  onPress={() => {
                    onSelect(opt.id);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[typography.body, { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SwitchCard({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchCard}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.success }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={18} color={colors.warning} />
      <Text style={[typography.bodyBold, { color: colors.text, marginLeft: spacing.xs, letterSpacing: 0.5 }]}>
        {title}
      </Text>
    </View>
  );
}

export default function AdminResidentFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    addResident,
    updateResident,
    recordRentPayment,
    residents,
    rooms,
    properties,
    dailyGuests,
    transferResidentRoom,
  } = useAdmin();

  const residentId: string | undefined = route.params?.residentId;
  const isEdit = !!residentId;
  const existing = isEdit ? residents.find((r) => r.id === residentId) : undefined;

  // The room to pre-derive `floor` from: either the resident being edited's
  // current room, OR a room pre-selected via route.params (e.g. tapping
  // "Add Resident" from a specific room's detail screen). Previously this
  // only looked at `existing`, so adding via a pre-selected room left `floor`
  // null — which then let the Floor picker silently wipe the pre-filled
  // roomId if it was ever opened, causing "Missing Information" even though
  // a room had already been chosen.
  const prefilledRoomId = existing?.roomId ?? route.params?.roomId;
  const prefilledRoom = prefilledRoomId ? rooms.find((r) => r.id === prefilledRoomId) : undefined;

  // ---- Personal details ----
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [guardianName, setGuardianName] = useState(existing?.guardianName ?? '');
  const [guardianPhone, setGuardianPhone] = useState(existing?.guardianPhone ?? '');
  const [gender, setGender] = useState<AdminGender | null>(existing?.gender ?? null);

  // ---- Room ----
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? route.params?.propertyId ?? '');
  const [floor, setFloor] = useState<number | null>(prefilledRoom?.floor ?? null);
  const [roomId, setRoomId] = useState(existing?.roomId ?? route.params?.roomId ?? '');
  const [joiningDate, setJoiningDate] = useState<Date>(
    existing ? parseDate(existing.joiningDate) ?? new Date() : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ---- Payment & charges ----
  const [isPreBooking, setIsPreBooking] = useState(existing?.isPreBooking ?? false);
  const [firstMonthPaid, setFirstMonthPaid] = useState(true);
  const [monthlyRent, setMonthlyRent] = useState(existing ? String(existing.monthlyRent) : '');
  const [depositStatus, setDepositStatus] = useState<DepositStatus>(
    existing?.advanceDepositStatus ?? (existing && existing.securityDeposit <= 0 ? 'No Advance' : 'Paid')
  );
  const [depositAmount, setDepositAmount] = useState(existing ? String(existing.securityDeposit) : '');
  const [maintenanceFee, setMaintenanceFee] = useState(
    existing?.maintenanceFee !== undefined ? String(existing.maintenanceFee) : ''
  );
  const [rentDueDay, setRentDueDay] = useState(existing ? String(existing.rentDueDay) : '5');
  // Tracks whether the admin chose their own due day, so picking a joining
  // date never overwrites a value they entered on purpose.
  const [dueDayEdited, setDueDayEdited] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payAmountEdited, setPayAmountEdited] = useState(false);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payReference, setPayReference] = useState('');

  // ---- Vehicle (optional) ----
  const [vehicleOpen, setVehicleOpen] = useState(!!existing?.vehicleType);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(existing?.vehicleType ?? null);
  const [vehicleNumber, setVehicleNumber] = useState(existing?.vehicleNumber ?? '');
  const [vehicleModel, setVehicleModel] = useState(existing?.vehicleModel ?? '');

  const [termsAgreed, setTermsAgreed] = useState(isEdit);

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedRoom = rooms.find((r) => r.id === roomId);

  const floorsForProperty = propertyId
    ? Array.from(new Set(rooms.filter((r) => r.propertyId === propertyId).map((r) => r.floor))).sort((a, b) => a - b)
    : [];

  const roomsWithAvailability = (propertyId && floor !== null)
    ? rooms
        .filter((r) => r.propertyId === propertyId && r.floor === floor)
        .map((r) => {
          const residentOccupants = residents.filter(
            (res) => res.roomId === r.id && res.id !== existing?.id
          ).length;
          const activeGuestOccupants = dailyGuests.filter(
            (g) => g.roomId === r.id && isDailyGuestActiveNow(g)
          ).length;
          const occupants = residentOccupants + activeGuestOccupants;
          const remaining = r.capacity - occupants;
          return { ...r, occupants, remaining };
        })
    : [];

  // ---- Payment summary (matches the Payment Summary & Calculations card) ----
  // The "Payment Amount" follows the monthly rent until the admin types their own.
  //   Bill Amount   = monthly rent + advance deposit (maintenance excluded)
  //   Amount Paid   = first-month payment (if recorded) + deposit (if marked Paid)
  //   Remaining Due = Bill Amount - Amount Paid (never below 0)
  const effectivePayAmount = payAmountEdited ? payAmount : monthlyRent;
  const rentNum = toNum(monthlyRent);
  const depositNum = depositStatus === 'No Advance' ? 0 : toNum(depositAmount);
  const payNum = toNum(effectivePayAmount);
  const maintenanceNum = toNum(maintenanceFee);
  const billAmount = rentNum + depositNum;
  const amountPaid = (firstMonthPaid ? payNum : 0) + (depositStatus === 'Paid' ? depositNum : 0);
  const remainingDue = Math.max(0, billAmount - amountPaid);

  const handleSelectProperty = (id: string) => {
    setPropertyId(id);
    setFloor(null);
    setRoomId('');
  };

  const handleSelectFloor = (floorIdStr: string) => {
    const newFloor = Number(floorIdStr);
    setFloor(newFloor);
    const stillValid = rooms.find((r) => r.id === roomId && r.floor === newFloor);
    if (!stillValid) setRoomId('');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setJoiningDate(selectedDate);
      // New residents: due day follows the joining date, unless the admin chose their own
      if (!isEdit && !dueDayEdited) {
        setRentDueDay(String(selectedDate.getDate()));
      }
    }
  };

  const handleSave = () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !gender || !propertyId || !roomId || !monthlyRent.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields, including gender, room and monthly rent.');
      return;
    }

    const rentValue = toNum(monthlyRent);
    if (rentValue <= 0) {
      Alert.alert('Invalid Rent', 'Please enter a valid rent amount.');
      return;
    }

    if (guardianPhone.trim() && guardianPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid Guardian Number', 'Please enter a valid 10-digit mobile number for the guardian.');
      return;
    }

    let depositValue = 0;
    if (depositStatus !== 'No Advance') {
      depositValue = toNum(depositAmount);
      if (!depositAmount.trim() || depositValue < 0) {
        Alert.alert('Invalid Deposit', 'Please enter a valid advance deposit amount.');
        return;
      }
    }

    if (maintenanceFee.trim() && toNum(maintenanceFee) < 0) {
      Alert.alert('Invalid Maintenance Fee', 'Please enter a valid maintenance amount.');
      return;
    }

    const dueDayValue = Number(rentDueDay);
    if (isNaN(dueDayValue) || dueDayValue < 1 || dueDayValue > 31) {
      Alert.alert('Invalid Due Day', 'Please choose a valid day of the month (1–31) for the rent due date.');
      return;
    }

    if (!isEdit && firstMonthPaid) {
      if (payNum <= 0) {
        Alert.alert('Missing Payment Amount', 'Enter the first month payment amount, or switch off "First Month Rent Paid".');
        return;
      }
      if (payNum < rentValue) {
        Alert.alert(
          'Payment Less Than Rent',
          `The payment (${formatINR(payNum)}) is less than the monthly rent (${formatINR(rentValue)}). Enter the full rent, or switch off "First Month Rent Paid" to leave the rent as Pending.`
        );
        return;
      }
    }

    if (!isEdit && !termsAgreed) {
      Alert.alert('Terms Required', 'Please agree to the Terms and Conditions to continue.');
      return;
    }

    const joiningDateStr = formatDate(joiningDate);

    // Optional details — empty values are stored as undefined.
    const extras = {
      guardianName: guardianName.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      maintenanceFee: maintenanceFee.trim() ? toNum(maintenanceFee) : undefined,
      advanceDepositStatus: depositStatus,
      isPreBooking,
      vehicleType: vehicleType ?? undefined,
      vehicleNumber: vehicleType && vehicleNumber.trim() ? vehicleNumber.trim().toUpperCase() : undefined,
      vehicleModel: vehicleType && vehicleModel.trim() ? vehicleModel.trim() : undefined,
    };

    if (isEdit && existing) {
      const roomChanged = existing.roomId !== roomId || existing.propertyId !== propertyId;
      if (roomChanged) {
        transferResidentRoom(existing.id, propertyId, roomId);
      }

      updateResident(existing.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gender,
        joiningDate: joiningDateStr,
        monthlyRent: rentValue,
        rentDueDay: dueDayValue,
        securityDeposit: depositValue,
        ...extras,
        ...(roomChanged ? {} : { propertyId, roomId }),
      });
      Alert.alert('Resident Updated', 'Changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      const newResident: Omit<AdminResident, 'id'> = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gender,
        propertyId,
        roomId,
        joiningDate: joiningDateStr,
        monthlyRent: rentValue,
        rentDueDay: dueDayValue,
        rentStatus: 'Pending',
        vacatingDate: null,
        securityDeposit: depositValue,
        vacateReason: null,
        emergencyVacateDeductionPercent: null,
        ...extras,
        firstMonthPayment: firstMonthPaid
          ? { amount: payNum, method: payMethod, reference: payReference.trim() || undefined }
          : undefined,
      };
      const created = addResident(newResident);

      // Record the first month's rent as paid, with the amount / method / reference from the form.
      if (firstMonthPaid) {
        recordRentPayment(created.id, payMethod, 'admin', {
          amount: payNum,
          transactionId: payReference.trim() || undefined,
          dueDay: dueDayValue,
        });
      }

      Alert.alert('Resident Added', `${name.trim()} has been added.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>
          {isEdit ? 'Edit Resident' : 'Add Resident'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Rahul Singh" />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="e.g. rahul@example.com" keyboardType="email-address" />

          <Field
            label="Father / Guardian Name"
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="e.g. Suresh Singh"
          />
          <Field
            label="Father / Guardian Mobile No."
            value={guardianPhone}
            onChangeText={setGuardianPhone}
            placeholder="+91 XXXXX XXXXX"
            keyboardType="phone-pad"
          />

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

          <SelectField
            label="Property"
            valueLabel={selectedProperty?.name}
            placeholder="Select a property"
            options={properties.map((p) => ({ id: p.id, label: p.name }))}
            onSelect={handleSelectProperty}
          />

          <SelectField
            label="Floor"
            valueLabel={floor !== null ? `Floor ${floor}` : undefined}
            placeholder={propertyId ? 'Select a floor' : 'Select a property first'}
            options={floorsForProperty.map((f) => ({ id: String(f), label: `Floor ${f}` }))}
            onSelect={handleSelectFloor}
            disabled={!propertyId}
          />

          <SelectField
            label="Room"
            valueLabel={
              selectedRoom
                ? `${selectedRoom.roomNumber} (${selectedRoom.capacity} Sharing)`
                : undefined
            }
            placeholder={floor !== null ? 'Select a room' : 'Select a floor first'}
            options={roomsWithAvailability
              .filter((r) => r.remaining > 0 || r.id === existing?.roomId)
              .map((r) => ({
                id: r.id,
                label: `${r.roomNumber} — ${r.capacity} Sharing (${r.remaining} bed${r.remaining !== 1 ? 's' : ''} left)`,
              }))}
            onSelect={setRoomId}
            disabled={floor === null}
          />

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>
              {isPreBooking ? 'Expected Joining Date' : 'Joining Date'}
            </Text>
            <TouchableOpacity
              style={styles.dateInput}
              activeOpacity={0.7}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[typography.body, { color: colors.text }]}>{formatDate(joiningDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={joiningDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                maximumDate={isPreBooking ? undefined : new Date()}
              />
            )}
          </View>

          {/* ---------------- Payment & Charges ---------------- */}
          <View style={styles.sectionCard}>
            <SectionTitle icon="shield-checkmark" title="PAYMENT & CHARGES" />

            {!isEdit && (
              <>
                <SwitchCard
                  title="Pre-booking Mode"
                  subtitle="Reserve bed prior to check-in"
                  value={isPreBooking}
                  onValueChange={setIsPreBooking}
                />
                <SwitchCard
                  title="First Month Rent Paid"
                  subtitle="Record check-in payment now"
                  value={firstMonthPaid}
                  onValueChange={setFirstMonthPaid}
                />
              </>
            )}

            <Field
              label="Monthly Rent (₹)"
              value={monthlyRent}
              onChangeText={setMonthlyRent}
              placeholder="e.g. 12000"
              keyboardType="numeric"
            />

            <Text style={[typography.caption, styles.label]}>Advance Deposit</Text>
            <View style={styles.radioRow}>
              {(['Paid', 'Not Paid', 'No Advance'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.radioItem}
                  activeOpacity={0.8}
                  onPress={() => setDepositStatus(opt)}
                >
                  <Ionicons
                    name={depositStatus === opt ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={depositStatus === opt ? colors.warning : colors.textMuted}
                  />
                  <Text style={[typography.caption, { color: colors.text, marginLeft: 6 }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {depositStatus !== 'No Advance' && (
              <Field
                label="Advance Deposit Amount (₹)"
                value={depositAmount}
                onChangeText={setDepositAmount}
                placeholder="e.g. 4000"
                keyboardType="numeric"
              />
            )}

            <View style={styles.twoCol}>
              <Field
                label="Maintenance (₹)"
                value={maintenanceFee}
                onChangeText={setMaintenanceFee}
                placeholder="e.g. 2000"
                keyboardType="numeric"
                containerStyle={styles.colField}
              />
              <View style={[styles.field, styles.colField]}>
                <Text style={[typography.caption, styles.label]}>Rent Due Date *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.selectInput]}
                  activeOpacity={0.7}
                  onPress={() => setDayPickerVisible(true)}
                >
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                    {ordinalDay(toNum(rentDueDay) || 5)} of every month
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.warning} />
                </TouchableOpacity>
              </View>
            </View>

            {!isEdit && firstMonthPaid && (
              <>
                <Text style={styles.subSectionTitle}>FIRST MONTH PAYMENT DETAILS</Text>
                <View style={styles.twoCol}>
                  <Field
                    label="Payment Amount (₹)"
                    value={effectivePayAmount}
                    onChangeText={(t) => {
                      setPayAmount(t);
                      setPayAmountEdited(true);
                    }}
                    placeholder="e.g. 12000"
                    keyboardType="numeric"
                    containerStyle={styles.colField}
                  />
                  <SelectField
                    label="Payment Method"
                    valueLabel={payMethod}
                    placeholder="Select"
                    options={PAYMENT_METHODS.map((m) => ({ id: m, label: m }))}
                    onSelect={setPayMethod}
                    containerStyle={styles.colField}
                  />
                </View>
                <Field
                  label="Transaction / Reference ID (Optional)"
                  value={payReference}
                  onChangeText={setPayReference}
                  placeholder="e.g. UPI Ref #892837492"
                />
              </>
            )}

            {!isEdit && (
              <>
                <Text style={[styles.subSectionTitle, { color: colors.warning }]}>PAYMENT SUMMARY & CALCULATIONS</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryLabel} numberOfLines={2}>BILL AMOUNT (Deposit+Rent)</Text>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{formatINR(billAmount)}</Text>
                  </View>
                  <View style={[styles.summaryTile, { borderColor: colors.success }]}>
                    <Text style={styles.summaryLabel}>AMOUNT PAID</Text>
                    <Text style={[typography.bodyBold, { color: colors.success }]}>{formatINR(amountPaid)}</Text>
                  </View>
                  <View style={styles.summaryTile}>
                    <Text style={styles.summaryLabel}>REMAINING DUE</Text>
                    <Text style={[typography.bodyBold, { color: remainingDue > 0 ? colors.error : colors.text }]}>
                      {formatINR(remainingDue)}
                    </Text>
                  </View>
                </View>
                {maintenanceNum > 0 && (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    • Maintenance Fee ({formatINR(maintenanceNum)}) is excluded from Bill Amount (Deposit + Rent).
                  </Text>
                )}
              </>
            )}
          </View>

          {/* ---------------- Vehicle details (optional) ---------------- */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.vehicleHeader}
              activeOpacity={0.8}
              onPress={() => setVehicleOpen((prev) => !prev)}
            >
              <Ionicons name="bicycle-outline" size={22} color={colors.warning} />
              <Text style={[typography.bodyBold, { color: colors.text, flex: 1, marginLeft: spacing.sm, letterSpacing: 0.5 }]}>
                VEHICLE DETAILS (OPTIONAL)
              </Text>
              <Ionicons name={vehicleOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {vehicleOpen && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, styles.label]}>Vehicle Type</Text>
                <View style={styles.toggleRow}>
                  {VEHICLE_TYPES.map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.toggleButton, vehicleType === v && styles.toggleButtonActive]}
                      onPress={() => setVehicleType(vehicleType === v ? null : v)}
                    >
                      <Text
                        style={[typography.caption, { color: vehicleType === v ? colors.white : colors.text, fontWeight: '600' }]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {vehicleType && (
                  <>
                    <Field
                      label="Vehicle Number"
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                      placeholder="e.g. AP 16 AB 1234"
                      autoCapitalize="characters"
                    />
                    <Field
                      label="Make / Model / Colour"
                      value={vehicleModel}
                      onChangeText={setVehicleModel}
                      placeholder="e.g. Honda Activa, Black"
                    />
                  </>
                )}
              </View>
            )}
          </View>

          {!isEdit && <TermsAgreement agreed={termsAgreed} onChange={setTermsAgreed} />}

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={() => navigation.goBack()}>
              <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>
                {isEdit ? 'Save Changes' : 'Register Resident'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Rent due day picker */}
      <Modal
        visible={dayPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDayPickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
            <Text style={[typography.bodyBold, { color: colors.text, padding: spacing.md }]}>
              Rent due on which day of the month?
            </Text>
            <View style={styles.dayGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                const selected = toNum(rentDueDay) === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayCell, selected && styles.dayCellActive]}
                    onPress={() => {
                      setRentDueDay(String(d));
                      setDueDayEdited(true);
                      setDayPickerVisible(false);
                    }}
                  >
                    <Text style={[typography.caption, { color: selected ? colors.white : colors.text, fontWeight: '700' }]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  containerStyle,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  containerStyle?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
      />
    </View>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
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
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectDisabled: {
    opacity: 0.5,
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
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.warning,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colField: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 72,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    maxHeight: 420,
  },
  modalOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  dayCellActive: {
    backgroundColor: colors.primary,
  },
  transferNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
});