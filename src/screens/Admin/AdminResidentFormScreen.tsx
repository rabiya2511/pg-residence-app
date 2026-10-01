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

function SelectField({
  label,
  valueLabel,
  placeholder,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  valueLabel: string | undefined;
  placeholder: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <View style={styles.field}>
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

export default function AdminResidentFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { addResident, updateResident, residents, rooms, properties, dailyGuests, transferResidentRoom } = useAdmin();

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

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [gender, setGender] = useState<AdminGender | null>(existing?.gender ?? null);
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? route.params?.propertyId ?? '');
  const [floor, setFloor] = useState<number | null>(prefilledRoom?.floor ?? null);
  const [roomId, setRoomId] = useState(existing?.roomId ?? route.params?.roomId ?? '');
  const [joiningDate, setJoiningDate] = useState<Date>(
    existing ? parseDate(existing.joiningDate) ?? new Date() : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState(existing ? String(existing.monthlyRent) : '');
  const [rentDueDay, setRentDueDay] = useState(existing ? String(existing.rentDueDay) : '5');
  // Tracks whether the admin typed their own due day, so picking a joining
  // date never overwrites a value they entered on purpose.
  const [dueDayEdited, setDueDayEdited] = useState(false);
  const [securityDeposit, setSecurityDeposit] = useState(existing ? String(existing.securityDeposit) : '');
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
      // New residents: due day follows the joining date, unless the admin typed their own
      if (!isEdit && !dueDayEdited) {
        setRentDueDay(String(selectedDate.getDate()));
      }
    }
  };

  const handleSave = () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !gender || !propertyId || !roomId || !monthlyRent.trim() || !securityDeposit.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields, including gender and security deposit.');
      return;
    }

    const rentValue = Number(monthlyRent);
    if (isNaN(rentValue) || rentValue <= 0) {
      Alert.alert('Invalid Rent', 'Please enter a valid rent amount.');
      return;
    }

    const depositValue = Number(securityDeposit);
    if (isNaN(depositValue) || depositValue < 0) {
      Alert.alert('Invalid Deposit', 'Please enter a valid security deposit amount.');
      return;
    }

    const dueDayValue = Number(rentDueDay);
    if (isNaN(dueDayValue) || dueDayValue < 1 || dueDayValue > 31) {
      Alert.alert('Invalid Due Day', 'Please enter a valid day of the month (1–31) for the rent due date.');
      return;
    }

    if (!isEdit && !termsAgreed) {
      Alert.alert('Terms Required', 'Please agree to the Terms and Conditions to continue.');
      return;
    }

    const joiningDateStr = formatDate(joiningDate);

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
      };
      addResident(newResident);
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            <Text style={[typography.caption, styles.label]}>Joining Date</Text>
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
                maximumDate={new Date()}
              />
            )}
          </View>

          <Field label="Monthly Rent" value={monthlyRent} onChangeText={setMonthlyRent} placeholder="e.g. 8500" keyboardType="numeric" />

          <Field
            label="Rent Due Day of Month"
            value={rentDueDay}
            onChangeText={(text) => {
              setRentDueDay(text);
              setDueDayEdited(true);
            }}
            placeholder="e.g. 5"
            keyboardType="numeric"
          />

          <Field
            label="Security Deposit"
            value={securityDeposit}
            onChangeText={setSecurityDeposit}
            placeholder="e.g. 10000"
            keyboardType="numeric"
          />

          {!isEdit && <TermsAgreement agreed={termsAgreed} onChange={setTermsAgreed} />}

          <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
            <Text style={[typography.button, { color: colors.white }]}>
              {isEdit ? 'Save Changes' : 'Add Resident'}
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
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
    maxHeight: 320,
  },
  modalOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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