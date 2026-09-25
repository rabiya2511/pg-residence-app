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
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';
import {
  DAILY_GUEST_RATE,
  AdminGender,
  AdminDailyGuestPaymentMethod,
  PG_UPI_ID,
  PG_PAYEE_NAME,
} from '../../constants/mockData';
import TermsAgreement from '../../components/TermsAgreement';

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

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
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

export default function AdminDailyGuestFormScreen() {
  const navigation = useNavigation<any>();
  const { addDailyGuest, residents, rooms, properties, dailyGuests } = useAdmin();

  const today = new Date();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<AdminGender | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [floor, setFloor] = useState<number | null>(null);
  const [roomId, setRoomId] = useState('');
  const [numDays, setNumDays] = useState('');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [uploadSide, setUploadSide] = useState<'front' | 'back' | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [joinDay, setJoinDay] = useState(String(today.getDate()).padStart(2, '0'));
  const [joinMonth, setJoinMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [joinYear, setJoinYear] = useState(String(today.getFullYear()));

  // Advance payment collected at booking time (optional — can be 0, partial, or full)
  const [advanceAmountInput, setAdvanceAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<AdminDailyGuestPaymentMethod | null>(null);

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedRoom = rooms.find((r) => r.id === roomId);

  const floorsForProperty = propertyId
    ? Array.from(new Set(rooms.filter((r) => r.propertyId === propertyId).map((r) => r.floor))).sort((a, b) => a - b)
    : [];

  const roomsWithAvailability = (propertyId && floor !== null)
    ? rooms
        .filter((r) => r.propertyId === propertyId && r.floor === floor)
        .map((r) => {
          const residentOccupants = residents.filter((res) => res.roomId === r.id).length;
          const activeGuestOccupants = dailyGuests.filter(
            (g) => g.roomId === r.id && isDailyGuestActiveNow(g)
          ).length;
          const occupants = residentOccupants + activeGuestOccupants;
          const remaining = r.capacity - occupants;
          return { ...r, occupants, remaining };
        })
    : [];

  const days = Number(numDays) || 0;
  const totalAmount = days * DAILY_GUEST_RATE;
  const advanceAmount = Math.min(totalAmount, Math.max(0, Number(advanceAmountInput) || 0));
  const pendingAmount = Math.max(0, totalAmount - advanceAmount);

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
    joinDateObj && days > 0
      ? new Date(joinDateObj.getFullYear(), joinDateObj.getMonth(), joinDateObj.getDate() + days)
      : null;

  const handleSelectProperty = (id: string) => {
    setPropertyId(id);
    setFloor(null);
    setRoomId('');
  };

  const handleSelectFloor = (floorIdStr: string) => {
    const newFloor = Number(floorIdStr);
    setFloor(newFloor);
    setRoomId('');
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.length) {
        if (uploadSide === 'front') setFrontUri(result.assets[0].uri);
        if (uploadSide === 'back') setBackUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
    } finally {
      setUploadSide(null);
    }
  };

  const browseFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        if (uploadSide === 'front') setFrontUri(result.assets[0].uri);
        if (uploadSide === 'back') setBackUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    } finally {
      setUploadSide(null);
    }
  };

  // Clears a wrongly-uploaded identity image so the admin can re-upload the correct one
  const removeIdentityImage = (side: 'front' | 'back') => {
    Alert.alert(
      'Remove Document',
      `Remove the uploaded ${side === 'front' ? 'front' : 'back'} side document?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (side === 'front') setFrontUri(null);
            else setBackUri(null);
          },
        },
      ]
    );
  };

 const handleSave = () => {
  if (!name.trim() || !phone.trim() || !email.trim() || !gender || !propertyId || !roomId || days <= 0) {
    Alert.alert('Missing Information', 'Please fill in all fields, including gender and number of days.');
    return;
  }
  if (!joinDateObj) {
    Alert.alert('Invalid Joining Date', 'Please enter a valid joining date.');
    return;
  }
  if (advanceAmount > 0 && !paymentMethod) {
    Alert.alert('Select Payment Method', 'Please choose how the advance was paid.');
    return;
  }
  if (!termsAgreed) {
    Alert.alert('Terms Required', 'Please agree to the Terms and Conditions to continue.');
    return;
  }

    const newGuest = addDailyGuest({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gender,
      propertyId,
      roomId,
      checkInDate: formatDate(joinDateObj),
      checkInTimestamp: joinDateObj.getTime(),
      vacatingDate: vacatingDateObj ? formatDate(vacatingDateObj) : '',
      numDays: days,
      totalAmount,
      identityFrontUri: frontUri,
      identityBackUri: backUri,
      advanceAmount,
      paymentStatus: advanceAmount >= totalAmount && totalAmount > 0 ? 'Paid' : 'Pending',
      paymentMethod: advanceAmount > 0 ? paymentMethod : null,
    });

    navigation.replace('AdminDailyGuestReceipt', { guestId: newGuest.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Add Day Guest</Text>
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
            valueLabel={selectedRoom ? `${selectedRoom.roomNumber} (${selectedRoom.capacity} Sharing)` : undefined}
            placeholder={floor !== null ? 'Select a room' : 'Select a floor first'}
            options={roomsWithAvailability
              .filter((r) => r.remaining > 0)
              .map((r) => ({
                id: r.id,
                label: `${r.roomNumber} — ${r.capacity} Sharing (${r.remaining} bed${r.remaining !== 1 ? 's' : ''} left)`,
              }))}
            onSelect={setRoomId}
            disabled={floor === null}
          />

          <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Identity Proof</Text>
          <View style={styles.uploadRow}>
            <View style={styles.uploadSlot}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setUploadSide('front')}
                style={styles.uploadTapArea}
              >
                {frontUri ? (
                  <Image source={{ uri: frontUri }} style={styles.thumbnail} />
                ) : (
                  <View style={styles.placeholderThumb}>
                    <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
              {frontUri && (
                <TouchableOpacity
                  style={styles.removeBadge}
                  activeOpacity={0.8}
                  onPress={() => removeIdentityImage('front')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              )}
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Front Side</Text>
            </View>

            <View style={styles.uploadSlot}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setUploadSide('back')}
                style={styles.uploadTapArea}
              >
                {backUri ? (
                  <Image source={{ uri: backUri }} style={styles.thumbnail} />
                ) : (
                  <View style={styles.placeholderThumb}>
                    <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
              {backUri && (
                <TouchableOpacity
                  style={styles.removeBadge}
                  activeOpacity={0.8}
                  onPress={() => removeIdentityImage('back')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              )}
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Back Side</Text>
            </View>
          </View>

          <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Joining Date</Text>
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

          <Field
            label="Number of Days"
            value={numDays}
            onChangeText={setNumDays}
            placeholder="e.g. 5"
            keyboardType="numeric"
          />

          {vacatingDateObj && (
            <View style={styles.vacatingCard}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Vacating Date</Text>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{formatDate(vacatingDateObj)}</Text>
              </View>
            </View>
          )}

          <Field
            label="Advance Amount Paid Now (optional)"
            value={advanceAmountInput}
            onChangeText={setAdvanceAmountInput}
            placeholder="e.g. 1000"
            keyboardType="numeric"
          />

          {advanceAmount > 0 && (
            <>
              <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Payment Method</Text>
              <View style={styles.toggleRow}>
                {(['Cash', 'UPI'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.toggleButton, paymentMethod === method && styles.toggleButtonActive]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={[typography.body, { color: paymentMethod === method ? colors.white : colors.text }]}>
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {paymentMethod === 'UPI' && (
                <View style={styles.qrCard}>
                  <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                    Scan to pay ₹{advanceAmount.toLocaleString()}
                  </Text>
                  <QRCode
                    value={buildUpiLink(advanceAmount, `Advance for ${name.trim() || 'Day Guest'}`)}
                    size={180}
                  />
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                    {PG_UPI_ID}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.amountCard}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {days > 0 ? `${days} day${days > 1 ? 's' : ''} × ₹${DAILY_GUEST_RATE}/day` : `₹${DAILY_GUEST_RATE}/day`}
            </Text>
            <Text style={[typography.heading2, { color: colors.text, marginTop: 4 }]}>
              ₹{totalAmount.toLocaleString()}
            </Text>
            {advanceAmount > 0 && (
              <View style={styles.amountBreakdownRow}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Advance: ₹{advanceAmount.toLocaleString()}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Pending: ₹{pendingAmount.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
          <TermsAgreement agreed={termsAgreed} onChange={setTermsAgreed} />

          <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
            <Text style={[typography.button, { color: colors.white }]}>Save & Generate Invoice</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!uploadSide} transparent animationType="fade" onRequestClose={() => setUploadSide(null)}>
        <TouchableOpacity style={styles.optionOverlay} activeOpacity={1} onPress={() => setUploadSide(null)}>
          <View style={styles.optionSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              {uploadSide === 'front' ? 'Upload Front Side' : 'Upload Back Side'}
            </Text>
            <TouchableOpacity style={styles.optionRow} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={browseFiles}>
              <Ionicons name="folder-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Browse Files</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancel} onPress={() => setUploadSide(null)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
  uploadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  uploadSlot: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    position: 'relative',
  },
  uploadTapArea: {
    alignItems: 'center',
  },
  thumbnail: { width: 80, height: 56, borderRadius: radius.sm },
  placeholderThumb: {
    width: 80,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateInput: {
    flex: 1,
    textAlign: 'center',
  },
  dateInputYear: {
    flex: 1.4,
    textAlign: 'center',
  },
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
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  amountCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  amountBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.sm, maxHeight: 320 },
  modalOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: spacing.lg, paddingBottom: spacing.xl },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  optionCancel: { alignItems: 'center', paddingTop: spacing.md },
});