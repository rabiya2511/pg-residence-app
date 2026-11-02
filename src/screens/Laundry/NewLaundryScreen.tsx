import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMyLaundry, SERVICE_TYPES, PICKUP_SLOTS } from '../../hooks/useLaundry';
import { useResident } from '../../context/ResidentContext';

export default function NewLaundryScreen() {
  const navigation = useNavigation<any>();
  const { addRequest } = useMyLaundry();
  const { residentData } = useResident();

  const [service, setService] = useState(SERVICE_TYPES[0]);
  const [count, setCount] = useState('');
  const [dayIndex, setDayIndex] = useState(1);
  const [slot, setSlot] = useState(PICKUP_SLOTS[0]);
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Today and the next 6 days.
  const dayOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        return {
          ts: d.getTime(),
          label:
            i === 0
              ? 'Today'
              : i === 1
              ? 'Tomorrow'
              : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          display: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        };
      }),
    []
  );

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.length) setImageUri(result.assets[0].uri);
    } catch {
      Alert.alert('Unable to Open Gallery', 'Could not open the photo picker on this device.');
    }
  };

  const handleSubmit = async () => {
    if (sending) return;
    const n = parseInt(count, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      Alert.alert('Number of Clothes', 'Enter how many clothes you are giving, between 1 and 99.');
      return;
    }
    const day = dayOptions[dayIndex];

    setSending(true);
    const result = await addRequest({
      numClothes: n,
      serviceType: service,
      notes,
      imageUri,
      pickupDate: day.display,
      pickupDateTs: day.ts,
      pickupSlot: slot,
    });
    setSending(false);

    if (!result.ok) {
      // Stay on the form with everything still filled in.
      Alert.alert('Could Not Send Request', result.message ?? 'Please try again.');
      return;
    }
    Alert.alert('Request Sent', `Your laundry pickup is booked for ${day.display}, ${slot}.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const label = (text: string, first = false) => (
    <Text style={[typography.bodyBold, { color: colors.text, marginTop: first ? 0 : spacing.lg, marginBottom: spacing.sm }]}>
      {text}
    </Text>
  );

  const chip = (text: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity key={text} style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '600' }]}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }} disabled={sending}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Book Laundry</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Booking for</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              {residentData.name} · Room {residentData.room}
            </Text>
          </View>

          {label('Service *')}
          <View style={styles.wrap}>{SERVICE_TYPES.map((s) => chip(s, service === s, () => setService(s)))}</View>

          {label('Number of Clothes *')}
          <TextInput
            style={styles.input}
            placeholder="e.g. 12"
            placeholderTextColor={colors.textMuted}
            value={count}
            onChangeText={(t) => setCount(t.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />

          {label('Pickup Date *')}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {dayOptions.map((d, i) => chip(d.label, dayIndex === i, () => setDayIndex(i)))}
          </ScrollView>

          {label('Pickup Time *')}
          <View style={styles.wrap}>{PICKUP_SLOTS.map((s) => chip(s, slot === s, () => setSlot(s)))}</View>

          {label('Notes (optional)')}
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="e.g. Separate whites, delicate items"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {label('Photo (optional)')}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.8}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photo} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Add</Text>
                </>
              )}
            </TouchableOpacity>
            {!!imageUri && (
              <TouchableOpacity onPress={() => setImageUri(null)} style={{ marginLeft: spacing.md }}>
                <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg }]}>
            The admin will confirm the pickup, set the charges and the expected delivery date. You can follow the status on the Laundry screen.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, sending && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator color={colors.white} /> : <Text style={[typography.button, { color: colors.white }]}>Send Request</Text>}
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  photoBtn: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});