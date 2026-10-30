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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';
import { AdminResident, AdminGender } from '../../constants/mockData';
import TermsAgreement from '../../components/TermsAgreement';
import PhoneInput from '../../components/common/PhoneInput';
import { validatePhone, normalizePhone } from '../../utils/phone';

type DepositStatus = 'Paid' | 'Not Paid' | 'No Advance';
type VehicleType = 'Bicycle' | 'Two-Wheeler' | 'Four-Wheeler';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer'];
const VEHICLE_TYPES: VehicleType[] = ['Bicycle', 'Two-Wheeler', 'Four-Wheeler'];
const GOV_ID_TYPES = ['Aadhar Card', 'PAN Card', 'Driving License', 'Passport', 'Voter ID'];
const OFFICE_ID_TYPES = ['Office', 'College', 'School', 'Other'];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Parses "24 Sep 2026" (dd MMM yyyy) back into a Date so editing keeps the real joining date.
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

const toNum = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};
const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ---- image helpers: files via DocumentPicker (the system photo picker crashes on some emulators) ----
async function pickImageFromFiles(onPicked: (uri: string) => void) {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length) onPicked(result.assets[0].uri);
  } catch {
    Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
  }
}

async function takePhotoWithCamera(onPicked: (uri: string) => void, square = false) {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      ...(square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
    });
    if (!result.canceled && result.assets?.length) onPicked(result.assets[0].uri);
  } catch {
    Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
  }
}

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

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalSheet}>
            {options.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted, padding: spacing.md }]}>No options available</Text>
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

// One upload tile: shows the picked image (with a remove badge) or the Upload / Camera buttons.
function UploadSlot({
  tag,
  uri,
  onUpload,
  onCamera,
  onRemove,
  style,
}: {
  tag: string;
  uri: string | null;
  onUpload: () => void;
  onCamera: () => void;
  onRemove: () => void;
  style?: any;
}) {
  return (
    <View style={[styles.uploadSlot, style]}>
      <View style={styles.uploadTag}>
        <Text style={[typography.caption, { color: colors.warning, fontWeight: '700', fontSize: 11 }]}>{tag}</Text>
      </View>
      {uri ? (
        <View style={{ alignItems: 'center' }}>
          <Image source={{ uri }} style={styles.uploadPreview} />
          <TouchableOpacity style={styles.removeBadge} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={14} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.uploadButtonsRow}>
          <TouchableOpacity style={styles.uploadCircle} activeOpacity={0.8} onPress={onUpload}>
            <Ionicons name="images-outline" size={22} color={colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadCircle} activeOpacity={0.8} onPress={onCamera}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {uri ? 'Tap ✕ to replace' : 'Upload or Camera'}
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
    identityDocuments,
    setIdentityDocumentUri,
    transferResidentRoom,
  } = useAdmin();

  const residentId: string | undefined = route.params?.residentId;
  const isEdit = !!residentId;
  const existing = isEdit ? residents.find((r) => r.id === residentId) : undefined;
  const existingDocs = existing ? identityDocuments.find((d) => d.residentId === existing.id) : undefined;

  const prefilledRoomId = existing?.roomId ?? route.params?.roomId;
  const prefilledRoom = prefilledRoomId ? rooms.find((r) => r.id === prefilledRoomId) : undefined;

  // ---- Profile photo ----
  const [profileUri, setProfileUri] = useState<string | null>(existing?.profileImageUri ?? null);

  // ---- Personal details ----
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [guardianName, setGuardianName] = useState(existing?.guardianName ?? '');
  const [guardianPhone, setGuardianPhone] = useState(existing?.guardianPhone ?? '');
  const [permanentAddress, setPermanentAddress] = useState(
    ((existing as any)?.permanentAddress ?? (existing as any)?.address ?? '').toString()
  );
  const [gender, setGender] = useState<AdminGender | null>(existing?.gender ?? null);

  // ---- Identity & documents ----
  const [idDocType, setIdDocType] = useState(existing?.idDocType ?? 'Aadhar Card');
  const [idDocNumber, setIdDocNumber] = useState(existing?.idDocNumber ?? '');
  const [idFrontUri, setIdFrontUri] = useState<string | null>(existingDocs?.frontUri ?? null);
  const [idBackUri, setIdBackUri] = useState<string | null>(existingDocs?.backUri ?? null);
  const [officeIdType, setOfficeIdType] = useState(existing?.officeIdType ?? 'Office');
  const [officeIdCode, setOfficeIdCode] = useState(existing?.officeIdCode ?? '');
  const [officeIdUri, setOfficeIdUri] = useState<string | null>(existing?.officeIdUri ?? null);

  // ---- Room ----
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? route.params?.propertyId ?? '');
  const [floor, setFloor] = useState<number | null>(prefilledRoom?.floor ?? null);
  const [roomId, setRoomId] = useState(existing?.roomId ?? route.params?.roomId ?? '');
  const [bedNumber, setBedNumber] = useState<number | null>(existing?.bedNumber ?? null);
  const [joiningDate, setJoiningDate] = useState<Date>(
    existing ? parseDate(existing.joiningDate) ?? new Date() : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ---- Payment & charges ----
  const [isPreBooking, setIsPreBooking] = useState(existing?.isPreBooking ?? false);
  // New residents must pick Paid / Not Paid explicitly (no silent default).
  const [rentChoice, setRentChoice] = useState<'Paid' | 'Not Paid' | null>(null);
  const firstMonthPaid = rentChoice === 'Paid';
  const [monthlyRent, setMonthlyRent] = useState(existing ? String(existing.monthlyRent) : '');
  const [depositChoice, setDepositChoice] = useState<DepositStatus | null>(
    existing ? existing.advanceDepositStatus ?? (existing.securityDeposit <= 0 ? 'No Advance' : 'Paid') : null
  );
  // Calculations treat "not chosen yet" like no advance; saving requires a choice.
  const depositStatus: DepositStatus = depositChoice ?? 'No Advance';
  const setDepositStatus = (v: DepositStatus) => setDepositChoice(v);
  const [depositAmount, setDepositAmount] = useState(existing ? String(existing.securityDeposit) : '');
  const [maintenanceFee, setMaintenanceFee] = useState(
    existing?.maintenanceFee !== undefined ? String(existing.maintenanceFee) : ''
  );
  const [rentDueDay, setRentDueDay] = useState(existing ? String(existing.rentDueDay) : '5');
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
// ---- Notes (optional) ----
const [notes, setNotes] = useState(existing?.notes ?? '');
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
          const residentOccupants = residents.filter((res) => res.roomId === r.id && res.id !== existing?.id).length;
          const activeGuestOccupants = dailyGuests.filter((g) => g.roomId === r.id && isDailyGuestActiveNow(g)).length;
          const occupants = residentOccupants + activeGuestOccupants;
          const remaining = r.capacity - occupants;
          return { ...r, occupants, remaining };
        })
    : [];

  // ---- Bed picker: beds already taken by other residents in the chosen room ----
  const takenBeds = new Set<number>(
    residents
      .filter((r) => r.roomId === roomId && r.id !== existing?.id && r.bedNumber !== undefined)
      .map((r) => r.bedNumber as number)
  );
  const bedOptions = selectedRoom ? Array.from({ length: selectedRoom.capacity }, (_, i) => i + 1) : [];
  const firstFreeBed = bedOptions.find((b) => !takenBeds.has(b)) ?? null;
  const effectiveBed = bedNumber !== null && !takenBeds.has(bedNumber) ? bedNumber : firstFreeBed;
  const selectedRoomAvailability = roomsWithAvailability.find((r) => r.id === roomId);

  // ---- Payment summary ----
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
    setBedNumber(null);
  };

  const handleSelectFloor = (floorIdStr: string) => {
    const newFloor = Number(floorIdStr);
    setFloor(newFloor);
    const stillValid = rooms.find((r) => r.id === roomId && r.floor === newFloor);
    if (!stillValid) {
      setRoomId('');
      setBedNumber(null);
    }
  };

  const handleSelectRoom = (id: string) => {
    setRoomId(id);
    setBedNumber(null);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setJoiningDate(selectedDate);
      if (!isEdit && !dueDayEdited) {
        setRentDueDay(String(selectedDate.getDate()));
      }
    }
  };
const handleSave = () => {
  const missing: string[] = [];
  if (!name.trim()) missing.push('Full Name');
  if (!phone.trim()) missing.push('Phone Number');
  if (!email.trim()) missing.push('Email');
  if (!gender) missing.push('Gender');
  if (!propertyId) missing.push('Property');
  if (!roomId) missing.push('Room');
  if (!monthlyRent.trim()) missing.push('Monthly Rent');

  if (missing.length > 0) {
    Alert.alert('Missing Information', `Please fill in: ${missing.join(', ')}.`);
    return;
  }

  if (!gender) return;
  const genderValue: AdminGender = gender;

  const phoneError = validatePhone(phone, { label: 'phone number' });
  if (phoneError) {
    Alert.alert('Invalid Phone Number', phoneError);
    return;
  }


    // Government ID is required for a NEW resident (editing never forces re-uploads).
    if (!isEdit) {
      if (!idDocNumber.trim()) {
        Alert.alert('Document Number Required', `Please enter the ${idDocType} number.`);
        return;
      }
      if (!idFrontUri || !idBackUri) {
        Alert.alert('Upload ID Proof', `Please upload both the front and back side of the ${idDocType}.`);
        return;
      }
    }

    const rentValue = toNum(monthlyRent);
    if (rentValue <= 0) {
      Alert.alert('Invalid Rent', 'Please enter a valid rent amount.');
      return;
    }

   const guardianError = validatePhone(guardianPhone, { required: false, label: 'guardian number' });
    if (guardianError) {
      Alert.alert('Invalid Guardian Number', guardianError);
      return;
    }

    if (!isEdit && rentChoice === null) {
      Alert.alert('First Month Rent', 'Please select whether the first month rent is Paid or Not Paid.');
      return;
    }
    if (depositChoice === null) {
      Alert.alert('Advance Deposit', 'Please select whether the advance deposit is Paid, Not Paid or No Advance.');
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
        Alert.alert('Missing Payment Amount', 'Enter the first month payment amount, or choose "Not Paid" for the first month rent.');
        return;
      }
      if (payNum < rentValue) {
        Alert.alert(
          'Payment Less Than Rent',
          `The payment (${formatINR(payNum)}) is less than the monthly rent (${formatINR(rentValue)}). Enter the full rent, or choose "Not Paid" to leave the rent as Pending.`
        );
        return;
      }
    }

    if (!isEdit && !termsAgreed) {
      Alert.alert('Terms Required', 'Please agree to the Terms and Conditions to continue.');
      return;
    }

    const joiningDateStr = formatDate(joiningDate);

    const hasOfficeId = !!(officeIdCode.trim() || officeIdUri);

    // Optional details — empty values are stored as undefined.
    const extras = {
      guardianName: guardianName.trim() || undefined,
      guardianPhone: guardianPhone.trim() ? normalizePhone(guardianPhone) : undefined,
      maintenanceFee: maintenanceFee.trim() ? toNum(maintenanceFee) : undefined,
      advanceDepositStatus: depositStatus,
      isPreBooking,
      vehicleType: vehicleType ?? undefined,
      vehicleNumber: vehicleType && vehicleNumber.trim() ? vehicleNumber.trim().toUpperCase() : undefined,
      vehicleModel: vehicleType && vehicleModel.trim() ? vehicleModel.trim() : undefined,
      // new: photo + ID details
      profileImageUri: profileUri,
      idDocType,
      idDocNumber: idDocNumber.trim() || undefined,
      officeIdType: hasOfficeId ? officeIdType : undefined,
      officeIdCode: officeIdCode.trim() || undefined,
      officeIdUri: officeIdUri,
      bedNumber: effectiveBed ?? undefined,
      notes: notes.trim() || undefined,
      permanentAddress: permanentAddress.trim() || undefined,
    };

    // Saves the government ID images into the Identity Documents list.
    const saveGovIdImages = (id: string) => {
      if (idFrontUri && idFrontUri !== existingDocs?.frontUri) setIdentityDocumentUri(id, 'front', idFrontUri);
      if (idBackUri && idBackUri !== existingDocs?.backUri) setIdentityDocumentUri(id, 'back', idBackUri);
    };

    if (isEdit && existing) {
      const roomChanged = existing.roomId !== roomId || existing.propertyId !== propertyId;
      if (roomChanged) {
        transferResidentRoom(existing.id, propertyId, roomId);
      }

      updateResident(existing.id, {
        name: name.trim(),
        phone: normalizePhone(phone),
        email: email.trim(),
         gender: genderValue,
        joiningDate: joiningDateStr,
        monthlyRent: rentValue,
        rentDueDay: dueDayValue,
        securityDeposit: depositValue,
        ...extras,
        ...(roomChanged ? {} : { propertyId, roomId }),
      });
      saveGovIdImages(existing.id);
      Alert.alert('Resident Updated', 'Changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      const newResident: Omit<AdminResident, 'id'> = {
        name: name.trim(),
        phone: normalizePhone(phone),
        email: email.trim(),
        gender: genderValue,
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
      saveGovIdImages(created.id);

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
        <Text style={[typography.heading3, { color: colors.text }]}>{isEdit ? 'Edit Resident' : 'Add Resident'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* ---------------- Profile photo ---------------- */}
          <View style={[styles.sectionCard, { alignItems: 'center' }]}>
            <Text style={[typography.caption, { color: colors.warning, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.md }]}>
              RESIDENT PROFILE PHOTO
            </Text>
            <View style={styles.avatarRing}>
              {profileUri ? (
                <Image source={{ uri: profileUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={[typography.heading1, { color: colors.white }]}>
                    {name.trim().charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.photoButtonRow}>
              <TouchableOpacity
                style={[styles.photoButton, styles.photoButtonOutline]}
                activeOpacity={0.85}
                onPress={() => pickImageFromFiles(setProfileUri)}
              >
                <Ionicons name="images-outline" size={18} color={colors.warning} />
                <Text style={[typography.caption, { color: colors.text, fontWeight: '700', marginLeft: 6 }]}>Upload Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, styles.photoButtonFilled]}
                activeOpacity={0.85}
                onPress={() => takePhotoWithCamera(setProfileUri, true)}
              >
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>Take Photo</Text>
              </TouchableOpacity>
            </View>
            {!!profileUri && (
              <TouchableOpacity style={{ marginTop: spacing.sm }} onPress={() => setProfileUri(null)}>
                <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Remove photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Field label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Rahul Singh" />
          <PhoneInput label="Phone Number" value={phone} onChange={setPhone} required />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="e.g. rahul@example.com" keyboardType="email-address" />

          <Field label="Father / Guardian Name" value={guardianName} onChangeText={setGuardianName} placeholder="e.g. Suresh Singh" />
          <PhoneInput label="Father / Guardian Mobile No." value={guardianPhone} onChange={setGuardianPhone} />

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

          {/* ---------------- Identity & Documents ---------------- */}
          <View style={styles.sectionCard}>
            <SectionTitle icon="shield-checkmark" title="IDENTITY & DOCUMENTS" />

            <Text style={[typography.caption, styles.label]}>Permanent Address</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, paddingTop: spacing.sm, marginBottom: spacing.md }]}
              value={permanentAddress}
              onChangeText={setPermanentAddress}
              placeholder="House no., street, area, city, state, PIN"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
            />

            <Text style={styles.subSectionTitle}>1. GOVERNMENT ID PROOF{isEdit ? '' : ' *'}</Text>
            <View style={styles.twoCol}>
              <SelectField
                label="Doc Type"
                valueLabel={idDocType}
                placeholder="Select"
                options={GOV_ID_TYPES.map((t) => ({ id: t, label: t }))}
                onSelect={setIdDocType}
                containerStyle={styles.colField}
              />
              <Field
                label="Document ID Number"
                value={idDocNumber}
                onChangeText={setIdDocNumber}
                placeholder="Enter number"
                autoCapitalize="characters"
                containerStyle={styles.colField}
              />
            </View>
            <View style={styles.twoCol}>
              <UploadSlot
                tag="FRONT SIDE"
                uri={idFrontUri}
                onUpload={() => pickImageFromFiles(setIdFrontUri)}
                onCamera={() => takePhotoWithCamera(setIdFrontUri)}
                onRemove={() => setIdFrontUri(null)}
                style={styles.colField}
              />
              <UploadSlot
                tag="BACK SIDE"
                uri={idBackUri}
                onUpload={() => pickImageFromFiles(setIdBackUri)}
                onCamera={() => takePhotoWithCamera(setIdBackUri)}
                onRemove={() => setIdBackUri(null)}
                style={styles.colField}
              />
            </View>

            <Text style={[styles.subSectionTitle, { marginTop: spacing.md }]}>2. OCCUPATION / INSTITUTION ID (OPTIONAL)</Text>
            <View style={styles.twoCol}>
              <SelectField
                label="ID Type"
                valueLabel={officeIdType}
                placeholder="Select"
                options={OFFICE_ID_TYPES.map((t) => ({ id: t, label: t }))}
                onSelect={setOfficeIdType}
                containerStyle={styles.colField}
              />
              <Field
                label="ID / Employee Code"
                value={officeIdCode}
                onChangeText={setOfficeIdCode}
                placeholder="Enter code"
                autoCapitalize="characters"
                containerStyle={styles.colField}
              />
            </View>
            <UploadSlot
              tag={`${officeIdType.toUpperCase()} ID CARD`}
              uri={officeIdUri}
              onUpload={() => pickImageFromFiles(setOfficeIdUri)}
              onCamera={() => takePhotoWithCamera(setOfficeIdUri)}
              onRemove={() => setOfficeIdUri(null)}
            />
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
            valueLabel={selectedRoom ? `${selectedRoom.roomNumber} (${selectedRoom.capacity} Sharing)` : undefined}
            placeholder={floor !== null ? 'Select a room' : 'Select a floor first'}
            options={roomsWithAvailability
              .filter((r) => r.remaining > 0 || r.id === existing?.roomId)
              .map((r) => ({
                id: r.id,
                label: `${r.roomNumber} — ${r.capacity} Sharing (${r.remaining} bed${r.remaining !== 1 ? 's' : ''} left)`,
              }))}
            onSelect={handleSelectRoom}
            disabled={floor === null}
          />

          {/* ---------------- Bed picker ---------------- */}
          {selectedRoom && (
            <View style={styles.bedCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>Room {selectedRoom.roomNumber} Details</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {selectedRoom.capacity} Sharing · Floor {selectedRoom.floor}
                  </Text>
                </View>
                <View style={styles.availableBadge}>
                  <Text style={[typography.caption, { color: colors.success, fontWeight: '700' }]}>
                    {selectedRoomAvailability?.remaining ?? 0} Available
                  </Text>
                </View>
              </View>
              <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Assign Bed:</Text>
              <View style={styles.toggleRow}>
                {bedOptions.map((b) => {
                  const taken = takenBeds.has(b);
                  const active = effectiveBed === b;
                  return (
                    <TouchableOpacity
                      key={b}
                      disabled={taken}
                      style={[styles.toggleButton, active && styles.toggleButtonActive, taken && { opacity: 0.4 }]}
                      onPress={() => setBedNumber(b)}
                    >
                      <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '700' }]}>
                        Bed {b}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>{isPreBooking ? 'Expected Joining Date' : 'Joining Date'}</Text>
            <TouchableOpacity style={styles.dateInput} activeOpacity={0.7} onPress={() => setShowDatePicker(true)}>
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
              </>
            )}

            <Field label="Monthly Rent (₹)" value={monthlyRent} onChangeText={setMonthlyRent} placeholder="e.g. 12000" keyboardType="numeric" />

            {!isEdit && rentNum <= 0 && (
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                Enter the monthly rent above to choose whether it is Paid or Not Paid.
              </Text>
            )}
            {!isEdit && rentNum > 0 && (
              <>
                <Text style={[typography.caption, styles.label]}>Monthly Rent Status *</Text>
                <View style={styles.radioRow}>
                  {(['Paid', 'Not Paid'] as const).map((opt) => (
                    <TouchableOpacity key={opt} style={styles.radioItem} activeOpacity={0.8} onPress={() => setRentChoice(opt)}>
                      <Ionicons
                        name={rentChoice === opt ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={rentChoice === opt ? (opt === 'Paid' ? colors.success : colors.error) : colors.textMuted}
                      />
                      <Text style={[typography.caption, { color: colors.text, marginLeft: 6 }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={[
                    styles.statusNote,
                    { backgroundColor: rentChoice === 'Paid' ? '#D1FAE5' : rentChoice === 'Not Paid' ? '#FEE2E2' : colors.background },
                  ]}
                >
                  <Ionicons
                    name={rentChoice === 'Paid' ? 'checkmark-circle' : rentChoice === 'Not Paid' ? 'alert-circle' : 'help-circle-outline'}
                    size={16}
                    color={rentChoice === 'Paid' ? colors.success : rentChoice === 'Not Paid' ? colors.error : colors.textMuted}
                  />
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: rentChoice === 'Paid' ? colors.success : rentChoice === 'Not Paid' ? colors.error : colors.textMuted,
                        marginLeft: 6,
                        flex: 1,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {rentChoice === 'Paid'
                      ? `Paid · Rent due: ${formatINR(0)}`
                      : rentChoice === 'Not Paid'
                      ? `Not Paid · Rent due: ${formatINR(rentNum)}`
                      : `Monthly rent ${formatINR(rentNum)} · select Paid or Not Paid`}
                  </Text>
                </View>
              </>
            )}

            <Text style={[typography.caption, styles.label]}>Advance Deposit *</Text>
            <View style={styles.radioRow}>
              {(['Paid', 'Not Paid', 'No Advance'] as const).map((opt) => (
                <TouchableOpacity key={opt} style={styles.radioItem} activeOpacity={0.8} onPress={() => setDepositStatus(opt)}>
                  <Ionicons
                    name={depositChoice === opt ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={
                      depositChoice === opt
                        ? opt === 'Paid'
                          ? colors.success
                          : opt === 'Not Paid'
                          ? colors.error
                          : colors.warning
                        : colors.textMuted
                    }
                  />
                  <Text style={[typography.caption, { color: colors.text, marginLeft: 6 }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {depositChoice === 'Not Paid' && (
              <View style={[styles.statusNote, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[typography.caption, { color: colors.error, marginLeft: 6, flex: 1 }]}>
                  Advance deposit will show as Not Paid (due).
                </Text>
              </View>
            )}

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
            <TouchableOpacity style={styles.vehicleHeader} activeOpacity={0.8} onPress={() => setVehicleOpen((prev) => !prev)}>
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
                      <Text style={[typography.caption, { color: vehicleType === v ? colors.white : colors.text, fontWeight: '600' }]}>
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
          {/* ---------------- Notes (optional) ---------------- */}
        <View style={styles.sectionCard}>
          <SectionTitle icon="create-outline" title="NOTES (OPTIONAL)" />
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes about this resident, e.g. food preference, special requests, remarks..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'right', marginTop: 4 }]}>
            {notes.length}/500
          </Text>
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
      <Modal visible={dayPickerVisible} transparent animationType="fade" onRequestClose={() => setDayPickerVisible(false)}>
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
                    <Text style={[typography.caption, { color: selected ? colors.white : colors.text, fontWeight: '700' }]}>{d}</Text>
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
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  containerStyle?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
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
        maxLength={maxLength}
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
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectDisabled: { opacity: 0.5 },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
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
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.warning,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  // profile photo
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarImage: { width: 98, height: 98, borderRadius: 49 },
  avatarFallback: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonRow: { flexDirection: 'row', gap: spacing.sm },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  photoButtonOutline: { borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.background },
  photoButtonFilled: { backgroundColor: colors.primary },
  // document upload slots
  uploadSlot: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  uploadTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  uploadButtonsRow: { flexDirection: 'row', gap: spacing.sm },
  uploadCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPreview: { width: '100%', height: 90, borderRadius: radius.sm },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // bed picker
  bedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  availableBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
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
  radioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  radioItem: { flexDirection: 'row', alignItems: 'center' },
  statusNote: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  colField: { flex: 1 },
  summaryRow: { flexDirection: 'row', gap: spacing.xs },
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
  vehicleHeader: { flexDirection: 'row', alignItems: 'center' },
  notesInput: { minHeight: 100, paddingTop: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.sm, maxHeight: 420 },
  modalOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  dayCellActive: { backgroundColor: colors.primary },
});