import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

const SHARING_OPTIONS = [1, 2, 3, 4];

type Errors = { floor?: string; roomNumber?: string; capacity?: string };

export default function AdminRoomFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { createRoom, updateRoom, rooms, residents, properties, activePropertyId } = useAdmin();

  const roomId: string | undefined = route.params?.roomId;
  const isEdit = !!roomId;
  const existing = isEdit ? rooms.find((r) => r.id === roomId) : undefined;
  // Property comes from the screen that opened the form; fall back to the one currently active.
  const propertyId: string | undefined = route.params?.propertyId ?? existing?.propertyId ?? activePropertyId ?? undefined;
  const property = properties.find((p) => p.id === propertyId);

  const [floor, setFloor] = useState(existing ? String(existing.floor) : '');
  const [roomNumber, setRoomNumber] = useState(existing?.roomNumber ?? '');
  const [capacity, setCapacity] = useState<number | null>(existing?.capacity ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const dirty = isEdit
    ? floor !== String(existing?.floor ?? '') || roomNumber !== (existing?.roomNumber ?? '') || capacity !== (existing?.capacity ?? null)
    : !!(floor.trim() || roomNumber.trim() || capacity);

  // The form stays open until the admin saves or cancels. Leaving with typed data asks first.
  const leave = () => {
    if (saving) return;
    if (!dirty) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard changes?', 'The details you entered will not be saved.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const validate = (): { floorNum: number; number: string; cap: number } | null => {
    const e: Errors = {};
    const number = roomNumber.trim();
    const floorNum = Number(floor);

    if (!floor.trim()) e.floor = 'Enter the floor number.';
    else if (!/^\d+$/.test(floor.trim()) || floorNum > 100) e.floor = 'Floor must be a whole number from 0 to 100.';

    if (!number) e.roomNumber = 'Enter the room number.';
    else if (number.length > 10) e.roomNumber = 'Room number can be at most 10 characters.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9\-\/ ]*$/.test(number)) e.roomNumber = 'Use letters, numbers, "-" or "/" only.';
    else {
      const dup = rooms.find(
        (r) =>
          r.propertyId === propertyId &&
          r.roomNumber.trim().toLowerCase() === number.toLowerCase() &&
          r.id !== existing?.id
      );
      if (dup) e.roomNumber = `Room ${number} already exists in ${property?.name ?? 'this property'}.`;
    }

    if (!capacity) e.capacity = 'Select how many beds the room has.';
    else if (isEdit && existing) {
      const inRoom = residents.filter((r) => r.roomId === existing.id).length;
      if (capacity < inRoom) {
        e.capacity = `${inRoom} resident${inRoom > 1 ? 's are' : ' is'} already in this room. Capacity cannot be below ${inRoom}.`;
      }
    }

    setErrors(e);
    if (Object.keys(e).length > 0 || !capacity) return null;
    return { floorNum, number, cap: capacity };
  };

  const resetForNext = () => {
    // Keep floor and sharing type: the next room is usually on the same floor.
    setRoomNumber('');
    setErrors({});
  };

  const handleSave = async () => {
    if (saving) return;
    if (!propertyId) {
      Alert.alert('No Property', 'Go back and select a property before adding a room.');
      return;
    }
    const v = validate();
    if (!v) return; // errors are shown under the fields, everything typed is kept

    setSaving(true);
    try {
      if (isEdit && existing) {
        updateRoom(existing.id, { floor: v.floorNum, roomNumber: v.number, capacity: v.cap });
        Alert.alert('Room Updated', 'Changes have been saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        const res = await createRoom(propertyId, v.floorNum, v.number, v.cap);
        if (!res.ok) {
          // Keep the form and its input so it can be corrected and retried.
          Alert.alert('Could Not Add Room', res.message ?? 'Please try again.');
          return;
        }
        Alert.alert('Room Added', `Room ${v.number} has been added to ${property?.name ?? 'the property'}.`, [
          { text: 'Add Another', onPress: resetForNext },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!propertyId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.heading3, { color: colors.text }]}>Add Room</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, padding: spacing.md }]}>
          No property is selected. Register or select a property first, then add rooms to it.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leave} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>{isEdit ? 'Edit Room' : 'Add Room'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.propertyBanner}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <Text style={[typography.bodyBold, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
              {property?.name ?? 'Property'}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>Floor Number *</Text>
            <TextInput
              style={[styles.input, !!errors.floor && styles.inputError]}
              value={floor}
              onChangeText={(t) => {
                setFloor(t.replace(/\D/g, '').slice(0, 3));
                if (errors.floor) setErrors((p) => ({ ...p, floor: undefined }));
              }}
              placeholder="e.g. 1 (0 = ground floor)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              editable={!saving}
            />
            {!!errors.floor && <Text style={styles.errorText}>{errors.floor}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>Room Number *</Text>
            <TextInput
              style={[styles.input, !!errors.roomNumber && styles.inputError]}
              value={roomNumber}
              onChangeText={(t) => {
                setRoomNumber(t);
                if (errors.roomNumber) setErrors((p) => ({ ...p, roomNumber: undefined }));
              }}
              placeholder="e.g. 101"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={10}
              editable={!saving}
            />
            {!!errors.roomNumber && <Text style={styles.errorText}>{errors.roomNumber}</Text>}
          </View>

          <Text style={[typography.caption, styles.label]}>Sharing Type *</Text>
          <View style={styles.toggleRow}>
            {SHARING_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                disabled={saving}
                style={[styles.toggleButton, capacity === n && styles.toggleButtonActive]}
                onPress={() => {
                  setCapacity(n);
                  if (errors.capacity) setErrors((p) => ({ ...p, capacity: undefined }));
                }}
              >
                <Text style={[typography.body, { color: capacity === n ? colors.white : colors.text }]}>{n}</Text>
                <Text style={[typography.caption, { color: capacity === n ? colors.white : colors.textMuted }]}>Sharing</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!errors.capacity && <Text style={[styles.errorText, { marginTop: -spacing.sm, marginBottom: spacing.md }]}>{errors.capacity}</Text>}

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={leave} disabled={saving}>
              <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={[typography.button, { color: colors.white }]}>
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Room'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  propertyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
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
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
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
  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelButton: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1.6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
});