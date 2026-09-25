import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

export default function AdminRoomFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { addRoom, updateRoom, rooms } = useAdmin();

  const roomId: string | undefined = route.params?.roomId;
  const isEdit = !!roomId;
  const existing = isEdit ? rooms.find((r) => r.id === roomId) : undefined;
  const propertyId: string = route.params?.propertyId ?? existing?.propertyId;

  const [floor, setFloor] = useState(existing ? String(existing.floor) : '');
  const [roomNumber, setRoomNumber] = useState(existing?.roomNumber ?? '');
  const [capacity, setCapacity] = useState<number | null>(existing?.capacity ?? null);
  // Guards against double-tap creating duplicate room records — addRoom
  // generates ids from Date.now(), so two rapid taps would otherwise create
  // two separate rooms with the same number, causing occupancy/availability
  // to look wrong on whichever one a resident ends up assigned to.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = () => {
    if (isSubmitting) return;

    const floorNum = Number(floor);
    if (!floor.trim() || isNaN(floorNum) || floorNum < 1) {
      Alert.alert('Invalid Floor', 'Please enter a valid floor number.');
      return;
    }
    if (!roomNumber.trim()) {
      Alert.alert('Missing Room Number', 'Please enter a room number.');
      return;
    }
    if (!capacity) {
      Alert.alert('Select Sharing Type', 'Please select how many beds this room has.');
      return;
    }

    const trimmedNumber = roomNumber.trim();

    // Prevents exactly the duplicate-room bug: same property + same room
    // number already exists (ignoring the room currently being edited).
    const duplicate = rooms.find(
      (r) =>
        r.propertyId === propertyId &&
        r.roomNumber.toLowerCase() === trimmedNumber.toLowerCase() &&
        r.id !== existing?.id
    );
    if (duplicate) {
      Alert.alert(
        'Room Already Exists',
        `Room ${trimmedNumber} already exists for this property. Use a different room number, or edit the existing one instead.`
      );
      return;
    }

    setIsSubmitting(true);

    if (isEdit && existing) {
      updateRoom(existing.id, { floor: floorNum, roomNumber: trimmedNumber, capacity });
      Alert.alert('Room Updated', 'Changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      addRoom(propertyId, floorNum, trimmedNumber, capacity);
      Alert.alert('Room Added', `Room ${trimmedNumber} has been added.`, [
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
          {isEdit ? 'Edit Room' : 'Add Room'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>Floor Number</Text>
            <TextInput
              style={styles.input}
              value={floor}
              onChangeText={setFloor}
              placeholder="e.g. 1"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>Room Number</Text>
            <TextInput
              style={styles.input}
              value={roomNumber}
              onChangeText={setRoomNumber}
              placeholder="e.g. 101"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[typography.caption, styles.label]}>Sharing Type</Text>
          <View style={styles.toggleRow}>
            {[1, 2, 3].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.toggleButton, capacity === n && styles.toggleButtonActive]}
                onPress={() => setCapacity(n)}
              >
                <Text style={[typography.body, { color: capacity === n ? colors.white : colors.text }]}>
                  {n} Sharing
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            <Text style={[typography.button, { color: colors.white }]}>
              {isEdit ? 'Save Changes' : 'Add Room'}
            </Text>
          </TouchableOpacity>
        </View>
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
  content: { padding: spacing.md },
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});