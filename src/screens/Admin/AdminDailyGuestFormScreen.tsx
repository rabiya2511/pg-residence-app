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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import {
  DAILY_GUEST_RATE,
  AdminGender,
  AdminDailyGuestPaymentMethod,
  PG_UPI_ID,
  PG_PAYEE_NAME,
} from '../../constants/mockData';
import TermsAgreement from '../../components/TermsAgreement';
import PhoneInput from '../../components/common/PhoneInput';
import { validatePhone, normalizePhone } from '../../utils/phone';
import {
  addDays,
  diffDays,
  formatGuestDate,
  rangesOverlap,
  startOfDay,
  stayCheckIn,
  stayEnd,
} from '../../utils/dailyGuestHelpers';

// Pre-filled security deposit (change to whatever your PG normally collects).
const DEFAULT_SECURITY_DEPOSIT = 1000;

// Only the Aadhaar card is collected as ID proof.
const ID_TYPE = 'Aadhaar Card';
const PAY_MODES: AdminDailyGuestPaymentMethod[] = ['UPI', 'Cash', 'Card', 'Bank Transfer'];
const VEHICLE_TYPES = ['Bicycle', 'Two-Wheeler', 'Four-Wheeler'] as const;
type VehicleType = (typeof VEHICLE_TYPES)[number];

const toNum = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};
const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function buildUpiLink(amount: number, note: string): string {
  const params = new URLSearchParams({ pa: PG_UPI_ID, pn: PG_PAYEE_NAME, am: amount.toFixed(2), cu: 'INR', tn: note });
  return `upi://pay?${params.toString()}`;
}

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

// ───────────────────────── small building blocks ─────────────────────────

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
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.selectInput, disabled && { opacity: 0.5 }]}
        activeOpacity={0.7}
        onPress={() => !disabled && setOpen(true)}
      >
        <Text style={[typography.body, { color: valueLabel ? colors.text : colors.textMuted, flex: 1 }]} numberOfLines={1}>
          {valueLabel || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              {options.length === 0 ? (
                <Text style={[typography.body, { color: colors.textMuted, padding: spacing.md }]}>No options available</Text>
              ) : (
                options.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={styles.modalOption}
                    onPress={() => {
                      onSelect(opt.id);
                      setOpen(false);
                    }}
                  >
                    <Text style={[typography.body, { color: colors.text }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  containerStyle?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
        maxLength={maxLength}
        multiline={multiline}
      />
      {!!hint && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{hint}</Text>}
    </View>
  );
}

function SectionCard({
  icon,
  title,
  badge,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={colors.warning} />
        <Text style={[typography.bodyBold, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>{title}</Text>
        {!!badge && (
          <View style={styles.sectionBadge}>
            <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700' }]}>{badge}</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

function DocCard({
  title,
  subtitle,
  uri,
  onUpload,
  onCamera,
  onRemove,
}: {
  title: string;
  subtitle: string;
  uri: string | null;
  onUpload: () => void;
  onCamera: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.docCard}>
      <View style={styles.docTop}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        </View>
        <View style={[styles.docStatus, uri && { backgroundColor: '#D1FAE5' }]}>
          <Text style={[typography.caption, { color: uri ? colors.success : colors.textMuted, fontWeight: '700' }]}>
            {uri ? 'Uploaded' : 'Not Uploaded'}
          </Text>
        </View>
      </View>

      {!!uri && (
        <View style={{ marginTop: spacing.sm }}>
          <Image source={{ uri }} style={styles.docPreview} />
          <TouchableOpacity style={styles.docRemove} onPress={onRemove} hitSlop={8}>
            <Ionicons name="close" size={14} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.docButtons}>
        <TouchableOpacity style={styles.docButton} activeOpacity={0.85} onPress={onUpload}>
          <Ionicons name="document-attach-outline" size={18} color={colors.warning} />
          <Text style={[typography.caption, styles.docButtonText]}>{uri ? 'Replace File' : 'Upload File'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.docButton} activeOpacity={0.85} onPress={onCamera}>
          <Ionicons name="camera-outline" size={18} color={colors.warning} />
          <Text style={[typography.caption, styles.docButtonText]}>Take Picture</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ───────────────────────── the registration form ─────────────────────────

export function DailyGuestRegistrationForm({
  onSaved,
  onCancel,
  initialRoomId,
  initialPropertyId,
}: {
  onSaved: (guestId: string) => void;
  onCancel: () => void;
  initialRoomId?: string;
  initialPropertyId?: string;
}) {
  const { addDailyGuest, uploadDailyGuestImage, residents, rooms, properties, dailyGuests } = useAdmin();

  // 1. profile photo
  const [profileUri, setProfileUri] = useState<string | null>(null);

  // 2. guest details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergency, setEmergency] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState<AdminGender | null>(null);

  // 3. stay & room
  const initialRoom = initialRoomId ? rooms.find((r) => r.id === initialRoomId) : undefined;
  const [propertyId, setPropertyId] = useState(
    initialPropertyId ?? initialRoom?.propertyId ?? (properties.length === 1 ? properties[0].id : '')
  );
  const [roomId, setRoomId] = useState(initialRoomId ?? '');
  const [bedNumber, setBedNumber] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState<Date>(startOfDay(new Date()));
  const [days, setDays] = useState(1);
  const [rate, setRate] = useState(String(DAILY_GUEST_RATE));
  const [picker, setPicker] = useState<null | 'in' | 'out'>(null);

  // 4. vehicle (optional)
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // 5. identity & KYC (Aadhaar card only)
  const idType = ID_TYPE;
  const [idNumber, setIdNumber] = useState('');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);

  // 6. payment
  const [deposit, setDeposit] = useState(String(DEFAULT_SECURITY_DEPOSIT));
  const [discount, setDiscount] = useState('0');
  const [advanceInput, setAdvanceInput] = useState('');
  const [payMode, setPayMode] = useState<AdminDailyGuestPaymentMethod>('UPI');
  const [payReference, setPayReference] = useState('');
  const [notes, setNotes] = useState('');

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  // ----- dates -----
  const checkOut = addDays(checkIn, days);
  const attachedCount = [frontUri, backUri].filter(Boolean).length;

  // ----- room availability for the chosen stay window -----
  const roomsOfProperty = rooms
    .filter((r) => r.propertyId === propertyId)
    .sort((a, b) => a.floor - b.floor || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

  const statsFor = (id: string) => {
    const room = rooms.find((r) => r.id === id);
    if (!room) return null;
    const residentsInRoom = residents.filter((r) => r.roomId === id);
    const guestsInRoom = dailyGuests.filter(
      (g) => g.roomId === id && !g.checkedOut && rangesOverlap(checkIn, checkOut, stayCheckIn(g), stayEnd(g))
    );
    const taken = new Set<number>();
    residentsInRoom.forEach((r) => r.bedNumber !== undefined && taken.add(r.bedNumber as number));
    guestsInRoom.forEach((g) => g.bedNumber !== undefined && taken.add(g.bedNumber as number));
    const occupied = residentsInRoom.length + guestsInRoom.length;
    return { room, occupied, available: Math.max(0, room.capacity - occupied), taken };
  };

  const roomStats = roomId ? statsFor(roomId) : null;
  const bedOptions = roomStats ? Array.from({ length: roomStats.room.capacity }, (_, i) => i + 1) : [];
  const firstFreeBed = roomStats ? bedOptions.find((b) => !roomStats.taken.has(b)) ?? null : null;
  const effectiveBed =
    bedNumber !== null && roomStats && !roomStats.taken.has(bedNumber) ? bedNumber : firstFreeBed;

  // ----- money -----
  const rateNum = toNum(rate);
  const grossRent = rateNum * days;
  const discountNum = Math.min(grossRent, toNum(discount));
  const netRent = Math.max(0, grossRent - discountNum);
  const depositNum = toNum(deposit);
  const grossTotal = netRent + depositNum;
  const collected = Math.min(toNum(advanceInput), grossTotal);
  const stayPaid = Math.min(collected, netRent); // the stay rent is cleared first
  const depositPaid = Math.min(depositNum, collected - stayPaid);
  const pendingDue = Math.max(0, grossTotal - collected);

  // ----- handlers -----
  const onPickDate = (event: any, d?: Date) => {
    if (Platform.OS !== 'ios') setPicker(null);
    if (event?.type === 'dismissed' || !d) return;
    if (picker === 'in') setCheckIn(startOfDay(d));
    else setDays(Math.max(1, diffDays(d, checkIn)));
  };

  const resetBed = () => setBedNumber(null);

  const handleSave = () => {
    if (saving) return;
    if (!name.trim()) return Alert.alert('Missing Information', 'Please enter the guest name.');
    const phoneError = validatePhone(phone, { label: 'guest phone number' });
    if (phoneError) return Alert.alert('Invalid Phone Number', phoneError);
    const emergencyError = validatePhone(emergency, { required: false, label: 'emergency contact' });
    if (emergencyError) return Alert.alert('Invalid Emergency Contact', emergencyError);
    if (!gender) return Alert.alert('Select Gender', 'Please choose the guest gender.');
    if (!propertyId) return Alert.alert('Select Property', 'Please choose a property.');
    if (!roomId || !roomStats) return Alert.alert('Select Room', 'Please choose a room.');
    if (roomStats.available <= 0 || effectiveBed === null)
      return Alert.alert('No Bed Available', 'That room has no free bed for these dates. Please pick another room or dates.');
    if (days < 1) return Alert.alert('Invalid Stay', 'The stay must be at least 1 day.');
    if (rateNum <= 0) return Alert.alert('Daily Rate Required', 'Please enter the daily rate.');
    if (toNum(discount) > grossRent) return Alert.alert('Invalid Discount', 'The discount cannot be more than the stay rent.');
    if (!idNumber.trim()) return Alert.alert('Aadhaar Number Required', `Please enter the ${idType} number.`);
    if (!frontUri || !backUri)
      return Alert.alert('Upload ID Proof', `Please upload both the front and back side of the ${idType}.`);
    if (!termsAgreed) return Alert.alert('Terms Required', 'Please agree to the Terms and Conditions to continue.');

    setSaving(true);
    const isFuture = checkIn.getTime() > startOfDay(new Date()).getTime();

    const newGuest = addDailyGuest({
      name: name.trim(),
      phone: normalizePhone(phone),
      email: email.trim(),
      gender,
      propertyId,
      roomId,
      checkInDate: formatGuestDate(checkIn),
      checkInTimestamp: checkIn.getTime(),
      vacatingDate: formatGuestDate(checkOut),
      numDays: days,
      totalAmount: netRent, // after discount; the security deposit is kept separate
      identityFrontUri: frontUri,
      identityBackUri: backUri,
      advanceAmount: stayPaid,
      paymentStatus: netRent === 0 || stayPaid >= netRent ? 'Paid' : 'Pending',
      paymentMethod: collected > 0 ? payMode : null,
      profileImageUri: profileUri,
      emergencyContact: emergency.trim() ? normalizePhone(emergency) : undefined,
      permanentAddress: address.trim() || undefined,
      idDocType: idType,
      idDocNumber: idNumber.trim(),
      bedNumber: effectiveBed,
      dailyRate: rateNum,
      discount: discountNum,
      notes: notes.trim() || undefined,
      securityDeposit: depositNum,
      depositPaid,
      advanceDepositStatus: depositNum > 0 ? (depositPaid >= depositNum ? 'Paid' : 'Not Paid') : 'No Advance',
      vehicleType: vehicleType ?? undefined,
      vehicleNumber: vehicleType && vehicleNumber.trim() ? vehicleNumber.trim().toUpperCase() : undefined,
      vehicleModel: vehicleType && vehicleModel.trim() ? vehicleModel.trim() : undefined,
      paymentReference: collected > 0 && payReference.trim() ? payReference.trim() : undefined,
      payments: stayPaid > 0 ? [{ amount: stayPaid, method: payMode, at: Date.now() }] : [],
      extendedDays: 0,
      checkedOut: false,
      isPreBooking: isFuture,
    });

    // Photos and the Aadhaar images go to cloud storage; the saved record is updated with their links.
    const uploads: [string, string | null][] = [
      ['profileImageUri', profileUri],
      ['identityFrontUri', frontUri],
      ['identityBackUri', backUri],
    ];
    uploads.forEach(([field, uri]) => uri && uploadDailyGuestImage(newGuest.id, field, uri));

    setSaving(false);
    onSaved(newGuest.id);
  };

  // ───────────────────────── render ─────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* intro */}
        <View style={styles.introCard}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.heading3, { color: colors.text }]}>Daily New Registration</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Register short-term guest, upload KYC & allocate bed
            </Text>
          </View>
          <View style={styles.dailyBadge}>
            <Text style={[typography.caption, { color: '#B45309', fontWeight: '700' }]}>Daily Base</Text>
          </View>
        </View>

        {/* 1. Photo */}
        <SectionCard icon="person" title="1. Guest Profile Photo" badge="Optional">
          <View style={{ alignItems: 'center' }}>
            <View style={styles.avatarRing}>
              {profileUri ? (
                <Image source={{ uri: profileUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={44} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Preview</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.docButtons}>
            <TouchableOpacity style={styles.docButton} activeOpacity={0.85} onPress={() => pickImageFromFiles(setProfileUri)}>
              <Ionicons name="images-outline" size={18} color={colors.warning} />
              <Text style={[typography.caption, styles.docButtonText]}>Upload Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docButton} activeOpacity={0.85} onPress={() => takePhotoWithCamera(setProfileUri, true)}>
              <Ionicons name="camera-outline" size={18} color={colors.warning} />
              <Text style={[typography.caption, styles.docButtonText]}>Take Picture</Text>
            </TouchableOpacity>
          </View>
          {!!profileUri && (
            <TouchableOpacity style={{ alignSelf: 'center', marginTop: spacing.sm }} onPress={() => setProfileUri(null)}>
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Remove photo</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* 2. Details */}
        <SectionCard icon="id-card-outline" title="2. Guest Details">
          <Field label="Guest Full Name *" value={name} onChangeText={setName} placeholder="e.g. Rahul Singh" autoCapitalize="words" />
          <PhoneInput label="Phone Number" value={phone} onChange={setPhone} required />
          <PhoneInput label="Emergency Contact" value={emergency} onChange={setEmergency} />
          <Field label="Email Address (Optional)" value={email} onChangeText={setEmail} placeholder="e.g. rahul@example.com" keyboardType="email-address" />
          <Field label="Permanent Address / Hometown" value={address} onChangeText={setAddress} placeholder="Village / Town, District, State" multiline />

          <Text style={[typography.caption, styles.label]}>Gender *</Text>
          <View style={styles.chipRow}>
            {(['Male', 'Female', 'Other'] as const).map((g) => (
              <TouchableOpacity key={g} style={[styles.chip, gender === g && styles.chipActive]} onPress={() => setGender(g)}>
                <Text style={[typography.body, { color: gender === g ? colors.white : colors.text }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* 3. Stay & room */}
        <SectionCard icon="bed-outline" title="3. Stay & Room Allocation">
          <SelectField
            label="Property *"
            valueLabel={properties.find((p) => p.id === propertyId)?.name}
            placeholder="Select a property"
            options={properties.map((p) => ({ id: p.id, label: p.name }))}
            onSelect={(id) => {
              setPropertyId(id);
              setRoomId('');
              resetBed();
            }}
          />

          <View style={styles.twoCol}>
            <SelectField
              label="Room No *"
              valueLabel={roomStats ? `Room ${roomStats.room.roomNumber}` : undefined}
              placeholder={propertyId ? 'Select room' : 'Pick property'}
              options={roomsOfProperty
                .map((r) => ({ r, s: statsFor(r.id) }))
                .filter(({ s }) => s && (s.available > 0 || r_isSelected(roomId, s.room.id)))
                .map(({ r, s }) => ({
                  id: r.id,
                  label: `Room ${r.roomNumber} · Floor ${r.floor} · ${r.capacity} Sharing (${s!.available} free)`,
                }))}
              onSelect={(id) => {
                setRoomId(id);
                resetBed();
              }}
              disabled={!propertyId}
              containerStyle={styles.colField}
            />
            <View style={styles.colField}>
              <Text style={[typography.caption, styles.label]}>Bed Allocation *</Text>
              <View style={styles.bedRow}>
                {bedOptions.length === 0 && (
                  <Text style={[typography.caption, { color: colors.textMuted, paddingTop: 10 }]}>Choose a room</Text>
                )}
                {bedOptions.map((b) => {
                  const taken = roomStats!.taken.has(b);
                  const active = effectiveBed === b;
                  return (
                    <TouchableOpacity
                      key={b}
                      disabled={taken}
                      style={[styles.bedChip, active && styles.chipActive, taken && { opacity: 0.35 }]}
                      onPress={() => setBedNumber(b)}
                    >
                      <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '700' }]}>B{b}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.capacityBox}>
            <View style={styles.capacityCol}>
              <Text style={styles.capacityLabel}>Total Capacity</Text>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{roomStats ? `${roomStats.room.capacity} Beds` : '—'}</Text>
            </View>
            <View style={styles.capacityCol}>
              <Text style={styles.capacityLabel}>Occupied Beds</Text>
              <Text style={[typography.bodyBold, { color: colors.warning }]}>{roomStats ? `${roomStats.occupied} Beds` : '—'}</Text>
            </View>
            <View style={styles.capacityCol}>
              <Text style={styles.capacityLabel}>Available / Empty</Text>
              <Text style={[typography.bodyBold, { color: colors.success }]}>{roomStats ? `${roomStats.available} Beds` : '—'}</Text>
            </View>
          </View>

          <View style={styles.twoCol}>
            <TouchableOpacity style={[styles.dateBox, styles.colField]} activeOpacity={0.8} onPress={() => setPicker('in')}>
              <View>
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>Check-In Date *</Text>
                <Text style={[typography.bodyBold, { color: colors.text, marginTop: 2 }]}>{formatGuestDate(checkIn)}</Text>
              </View>
              <Ionicons name="calendar-outline" size={20} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dateBox, styles.colField]} activeOpacity={0.8} onPress={() => setPicker('out')}>
              <View>
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>Check-Out Date *</Text>
                <Text style={[typography.bodyBold, { color: colors.text, marginTop: 2 }]}>{formatGuestDate(checkOut)}</Text>
              </View>
              <Ionicons name="calendar-outline" size={20} color={colors.warning} />
            </TouchableOpacity>
          </View>

          {picker && (
            <View>
              <DateTimePicker
                value={picker === 'in' ? checkIn : checkOut}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={picker === 'out' ? addDays(checkIn, 1) : undefined}
                onChange={onPickDate}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.pickerDone} onPress={() => setPicker(null)}>
                  <Text style={[typography.button, { color: colors.white }]}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={[styles.twoCol, { marginTop: spacing.sm }]}>
            <View style={[styles.stepper, styles.colField]}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDays((d) => Math.max(1, d - 1))}>
                <Ionicons name="remove" size={22} color={colors.warning} />
              </TouchableOpacity>
              <Text style={[typography.bodyBold, { color: colors.text }]}>
                {days} Day{days > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDays((d) => Math.min(365, d + 1))}>
                <Ionicons name="add" size={22} color={colors.warning} />
              </TouchableOpacity>
            </View>
            <Field
              label="Daily Rate (₹) *"
              value={rate}
              onChangeText={(t) => setRate(t.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 850"
              keyboardType="numeric"
              containerStyle={styles.colField}
            />
          </View>

          <View style={styles.rentBanner}>
            <Text style={[typography.body, { color: colors.text }]}>Total Stay Rent ({days} day{days > 1 ? 's' : ''}):</Text>
            <Text style={[typography.heading3, { color: '#B45309' }]}>{formatINR(grossRent)}</Text>
          </View>
        </SectionCard>

        {/* 4. Vehicle */}
        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.sectionHeader} activeOpacity={0.8} onPress={() => setVehicleOpen((v) => !v)}>
            <Ionicons name="bicycle-outline" size={20} color={colors.warning} />
            <Text style={[typography.bodyBold, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>4. Vehicle Details</Text>
            <View style={[styles.sectionBadge, { marginRight: spacing.sm }]}>
              <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700' }]}>Optional</Text>
            </View>
            <Ionicons name={vehicleOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          {vehicleOpen && (
            <View>
              <Text style={[typography.caption, styles.label]}>Vehicle Type</Text>
              <View style={styles.chipRow}>
                {VEHICLE_TYPES.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, vehicleType === v && styles.chipActive]}
                    onPress={() => setVehicleType(vehicleType === v ? null : v)}
                  >
                    <Text style={[typography.caption, { color: vehicleType === v ? colors.white : colors.text, fontWeight: '700' }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {vehicleType && (
                <>
                  <Field label="Vehicle Number" value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="e.g. AP 16 AB 1234" autoCapitalize="characters" />
                  <Field label="Make / Model / Colour" value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Honda Activa, Black" />
                </>
              )}
            </View>
          )}
        </View>

        {/* 5. Identity & KYC */}
        <SectionCard icon="document-text-outline" title="5. Identity & KYC Documents" badge={`${attachedCount} of 2 Attached`}>
          <View style={styles.twoCol}>
            <View style={[styles.field, styles.colField]}>
              <Text style={[typography.caption, styles.label]}>ID Type</Text>
              <View style={[styles.input, styles.selectInput]}>
                <Text style={[typography.body, { color: colors.text }]}>{ID_TYPE}</Text>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              </View>
            </View>
            <Field
              label="Aadhaar Number *"
              value={idNumber}
              onChangeText={setIdNumber}
              placeholder="Enter number"
              keyboardType="numeric"
              containerStyle={styles.colField}
            />
          </View>

          <DocCard
            title="Aadhaar Card – Front Side"
            subtitle="Front view of the Aadhaar card"
            uri={frontUri}
            onUpload={() => pickImageFromFiles(setFrontUri)}
            onCamera={() => takePhotoWithCamera(setFrontUri)}
            onRemove={() => setFrontUri(null)}
          />
          <DocCard
            title="Aadhaar Card – Back Side"
            subtitle="Back view containing permanent address details"
            uri={backUri}
            onUpload={() => pickImageFromFiles(setBackUri)}
            onCamera={() => takePhotoWithCamera(setBackUri)}
            onRemove={() => setBackUri(null)}
          />
        </SectionCard>

        {/* 6. Payment */}
        <SectionCard icon="card-outline" title="6. Payment Details & Summary">
          <View style={styles.twoCol}>
            <Field label="Security Deposit (₹)" value={deposit} onChangeText={(t) => setDeposit(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" containerStyle={styles.colField} />
            <Field label="Discount / Waiver (₹)" value={discount} onChangeText={(t) => setDiscount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" containerStyle={styles.colField} />
          </View>

          <View style={styles.field}>
            <View style={styles.advanceHeader}>
              <Text style={[typography.caption, styles.label, { marginBottom: 0 }]}>Advance Amount Collected (₹) *</Text>
              <TouchableOpacity onPress={() => setAdvanceInput(String(grossTotal))}>
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '800' }]}>Pay Full</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              value={advanceInput}
              onChangeText={(t) => setAdvanceInput(t.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
              Counted against the stay rent first, then the security deposit.
            </Text>
          </View>

          <Text style={[typography.caption, styles.label]}>Payment Mode</Text>
          <View style={styles.chipRow}>
            {PAY_MODES.map((m) => (
              <TouchableOpacity key={m} style={[styles.chip, payMode === m && styles.chipActive]} onPress={() => setPayMode(m)}>
                <Text style={[typography.caption, { color: payMode === m ? colors.white : colors.text, fontWeight: '700' }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {payMode === 'UPI' && collected > 0 && (
            <View style={styles.qrCard}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Scan to pay {formatINR(collected)}
              </Text>
              <QRCode value={buildUpiLink(collected, `Payment for ${name.trim() || 'Day Guest'}`)} size={170} />
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{PG_UPI_ID}</Text>
            </View>
          )}

          {collected > 0 && (
            <Field label="Transaction / Reference ID (Optional)" value={payReference} onChangeText={setPayReference} placeholder="e.g. UPI Ref #892837492" />
          )}

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={[typography.body, { color: colors.text }]}>Gross Total (Rent + Deposit):</Text>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{formatINR(grossTotal)}</Text>
            </View>
            {discountNum > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Includes discount of</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>-{formatINR(discountNum)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={[typography.body, { color: colors.success }]}>Advance Paid Now:</Text>
              <Text style={[typography.bodyBold, { color: colors.success }]}>{formatINR(collected)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Pending Due Balance:</Text>
              <Text style={[typography.heading3, { color: pendingDue > 0 ? colors.error : colors.success }]}>{formatINR(pendingDue)}</Text>
            </View>
          </View>

          <Field label="Notes / Special Requests" value={notes} onChangeText={setNotes} placeholder="Anything the team should know" multiline />
        </SectionCard>

        <TermsAgreement agreed={termsAgreed} onChange={setTermsAgreed} />

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={onCancel}>
            <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.confirmButton, saving && { opacity: 0.7 }]} activeOpacity={0.85} onPress={handleSave} disabled={saving}>
            <Text style={[typography.button, { color: colors.white }]}>Allocate Bed & Confirm Stay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// keeps the currently chosen room in the dropdown even when it has just filled up
const r_isSelected = (selectedId: string, id: string) => selectedId === id;

// ───────────────────────── standalone screen (route: AdminDailyGuestForm) ─────────────────────────

export default function AdminDailyGuestFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Daily Base – New Registration</Text>
        <View style={{ width: 22 }} />
      </View>
      <DailyGuestRegistrationForm
        initialRoomId={route.params?.roomId}
        initialPropertyId={route.params?.propertyId}
        onSaved={(guestId) => navigation.replace('AdminDailyGuestReceipt', { guestId })}
        onCancel={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  colField: { flex: 1 },

  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dailyBadge: { backgroundColor: '#FEF3C7', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionBadge: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4 },

  avatarRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  avatarImage: { width: 130, height: 130 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },

  docCard: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  docTop: { flexDirection: 'row', alignItems: 'flex-start' },
  docStatus: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  docPreview: { width: '100%', height: 110, borderRadius: radius.sm },
  docRemove: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  docButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  docButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  docButtonText: { color: colors.text, fontWeight: '700', marginLeft: 6 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  bedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bedChip: { minWidth: 40, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },

  capacityBox: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  capacityCol: { flex: 1 },
  capacityLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  dateBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  pickerDone: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, height: 50, marginTop: 20 },
  stepBtn: { padding: spacing.xs },
  rentBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs },

  advanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrCard: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  summaryBox: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelButton: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  confirmButton: { flex: 2, borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.sm, maxHeight: 420 },
  modalOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});