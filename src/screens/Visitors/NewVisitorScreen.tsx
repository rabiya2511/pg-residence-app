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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useVisitors } from '../../context/VisitorsContext';

const RELATIONSHIPS = ['Friend', 'Family', 'Colleague', 'Delivery', 'Other'];
const MAX_VISITORS = 5;
const TIME_RE = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i;

// "6:30 pm" -> "6:30 PM" (or null when it is not a valid time)
const normalizeTime = (t: string): string | null => {
  const m = t.trim().match(TIME_RE);
  return m ? `${parseInt(m[1], 10)}:${m[2]} ${m[3].toUpperCase()}` : null;
};
const toMinutes = (norm: string): number => {
  const m = norm.match(/^(\d+):(\d+) (AM|PM)$/)!;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
};

export default function NewVisitorScreen() {
  const navigation = useNavigation<any>();
  const { addVisitorRequest } = useVisitors();

  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [purpose, setPurpose] = useState('');
  const [numVisitors, setNumVisitors] = useState(1);
  const [dayIndex, setDayIndex] = useState(0);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [instructions, setInstructions] = useState('');
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

  // Shows ONE clear message for the first problem found.
  const validate = (): { arrival: string; departure: string } | null => {
    const fail = (title: string, message: string) => {
      Alert.alert(title, message);
      return null;
    };
    if (visitorName.trim().length < 2) return fail('Visitor Name', "Please enter the visitor's full name.");
    if (visitorPhone && !/^[6-9]\d{9}$/.test(visitorPhone)) {
      return fail('Invalid Phone Number', 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9, or leave it empty.');
    }
    if (!purpose.trim()) return fail('Purpose of Visit', 'Please enter the purpose of the visit.');

    const arr = normalizeTime(arrival);
    if (!arr) return fail('Arrival Time', 'Enter the arrival time like 6:30 PM.');

    if (dayIndex === 0) {
      const now = new Date();
      if (toMinutes(arr) < now.getHours() * 60 + now.getMinutes()) {
        return fail('Arrival Time', 'That time has already passed today. Pick a later time or another day.');
      }
    }

    let dep = '';
    if (departure.trim()) {
      const d = normalizeTime(departure);
      if (!d) return fail('Departure Time', 'Enter the departure time like 8:00 PM, or leave it empty.');
      if (toMinutes(d) <= toMinutes(arr)) return fail('Departure Time', 'Departure must be after the arrival time.');
      dep = d;
    }
    return { arrival: arr, departure: dep };
  };

  const handleSubmit = async () => {
    if (sending) return;
    const times = validate();
    if (!times) return;
    const day = dayOptions[dayIndex];

    setSending(true);
    const result = await addVisitorRequest({
      visitorName,
      visitorPhone,
      relationship,
      purpose,
      numVisitors,
      expectedDate: day.display,
      expectedDateTs: day.ts,
      expectedArrival: times.arrival,
      expectedDeparture: times.departure,
      instructions,
    });
    setSending(false);

    if (!result.ok) {
      // Stay on the form with everything still filled in.
      Alert.alert('Could Not Send Request', result.message ?? 'Please try again.');
      return;
    }
    Alert.alert(
      'Request Sent',
      `${visitorName.trim()}'s visit is waiting for the admin's approval. You can follow it on the Visitors screen.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const label = (text: string, first = false) => (
    <Text style={[typography.bodyBold, { color: colors.text, marginTop: first ? 0 : spacing.lg, marginBottom: spacing.sm }]}>
      {text}
    </Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={sending}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Request a Visit</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {label('Visitor Name *', true)}
          <TextInput
            style={styles.input}
            placeholder="Enter visitor's full name"
            placeholderTextColor={colors.textMuted}
            value={visitorName}
            onChangeText={setVisitorName}
          />

          {label('Visitor Mobile Number (optional)')}
          <TextInput
            style={styles.input}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.textMuted}
            value={visitorPhone}
            onChangeText={(t) => setVisitorPhone(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />

          {label('Relationship')}
          <View style={styles.wrapRow}>
            {RELATIONSHIPS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, relationship === r && styles.chipActive]}
                onPress={() => setRelationship(r)}
                activeOpacity={0.8}
              >
                <Text style={[typography.caption, { color: relationship === r ? colors.white : colors.text, fontWeight: '600' }]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {label('Purpose of Visit *')}
          <TextInput
            style={styles.input}
            placeholder="e.g., Meeting a friend, Parcel delivery"
            placeholderTextColor={colors.textMuted}
            value={purpose}
            onChangeText={setPurpose}
          />

          {label('Number of Visitors')}
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setNumVisitors((n) => Math.max(1, n - 1))}
              disabled={numVisitors <= 1}
            >
              <Ionicons name="remove" size={20} color={numVisitors <= 1 ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
            <Text style={[typography.heading3, { color: colors.text, minWidth: 40, textAlign: 'center' }]}>{numVisitors}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setNumVisitors((n) => Math.min(MAX_VISITORS, n + 1))}
              disabled={numVisitors >= MAX_VISITORS}
            >
              <Ionicons name="add" size={20} color={numVisitors >= MAX_VISITORS ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
          </View>

          {label('Expected Arrival Date *')}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {dayOptions.map((d, i) => (
              <TouchableOpacity
                key={d.ts}
                style={[styles.chip, dayIndex === i && styles.chipActive]}
                onPress={() => setDayIndex(i)}
                activeOpacity={0.8}
              >
                <Text style={[typography.caption, { color: dayIndex === i ? colors.white : colors.text, fontWeight: '600' }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              {label('Arrival Time *')}
              <TextInput
                style={styles.input}
                placeholder="6:30 PM"
                placeholderTextColor={colors.textMuted}
                value={arrival}
                onChangeText={setArrival}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              {label('Departure Time')}
              <TextInput
                style={styles.input}
                placeholder="8:00 PM"
                placeholderTextColor={colors.textMuted}
                value={departure}
                onChangeText={setDeparture}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>
          </View>

          {label('Additional Instructions')}
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Anything the admin or security should know"
            placeholderTextColor={colors.textMuted}
            value={instructions}
            onChangeText={setInstructions}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, sending && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.button, { color: colors.white }]}>Send Request</Text>
            )}
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: { flexDirection: 'row' },
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