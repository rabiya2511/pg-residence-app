import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getFirestore, collection, doc, onSnapshot, query, where, setDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { weekDays, weeklyMenu } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import { DEFAULT_TIMINGS } from '../../context/FoodContext';

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
type Draft = Record<string, Record<string, string>>; // day -> meal -> items, one per line

type Published = { draft: Draft; timings: Record<string, string>; note: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const sampleDraft = (): Draft => {
  const d: Draft = {};
  (weeklyMenu as any[]).forEach((m) => {
    d[m.day] = d[m.day] ?? {};
    // mockData stores each meal as one comma-separated string; the editor uses one item per line.
    d[m.day][m.mealType] = String(m.items)
      .split(',')
      .map((x: string) => x.trim())
      .filter(Boolean)
      .join('\n');
  });
  return d;
};

// A text fingerprint of the menu, ignoring spaces and empty lines, so it matches what is saved.
const menuKey = (d: Draft) =>
  (weekDays as string[])
    .map((day) =>
      MEALS.map((m) =>
        (d[day]?.[m] ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .join('|')
      ).join('||')
    )
    .join('###');

export default function AdminFoodMenuScreen() {
  const navigation = useNavigation<any>();
  const { activePropertyId, activeProperty } = useAdmin();
  const db = getFirestore();

  const [day, setDay] = useState<string>(weekDays[0]);
  const [draft, setDraft] = useState<Draft>(sampleDraft());
  const [timings, setTimings] = useState<Record<string, string>>({ ...DEFAULT_TIMINGS });
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<any[]>([]);
  const seeded = useRef(false);

  // What is currently published (the last saved menu). "Reset" goes back to this.
  const [published, setPublished] = useState<Published | null>(null);
  // The menu as it was just before "Copy to all days", so the copy can be undone.
  const [beforeCopy, setBeforeCopy] = useState<Draft | null>(null);

  // Load what is already published for this property.
  useEffect(() => {
    setLoaded(false);
    setPublished(null);
    setBeforeCopy(null);
    seeded.current = false;
    if (!activePropertyId) return;
    return onSnapshot(
      doc(db, 'foodMenus', activePropertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        const data = exists ? snap.data() : null;
        // Only the first snapshot seeds the form, so typing is never overwritten.
        if (seeded.current) return;
        seeded.current = true;
        const base = sampleDraft();
        if (data?.days) {
          Object.keys(data.days).forEach((dn) =>
            MEALS.forEach((m) => {
              const items: string[] | undefined = data.days[dn]?.[m];
              if (items && items.length) {
                base[dn] = base[dn] ?? {};
                base[dn][m] = items.join('\n');
              }
            })
          );
        }
        const loadedTimings = { ...DEFAULT_TIMINGS, ...(data?.timings ?? {}) };
        const loadedNote = data?.note ?? '';
        setDraft(base);
        setTimings(loadedTimings);
        setNote(loadedNote);
        setPublished({ draft: clone(base), timings: clone(loadedTimings), note: loadedNote });
        setLoaded(true);
      },
      (e: any) => console.warn('admin food menu listener:', e?.code)
    );
  }, [activePropertyId]);

  useEffect(() => {
    if (!activePropertyId) return;
    return onSnapshot(
      query(collection(db, 'foodFeedback'), where('propertyId', '==', activePropertyId)),
      (snap: any) => setFeedback(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('admin food feedback listener:', e?.code)
    );
  }, [activePropertyId]);

  const recent = useMemo(
    () => [...feedback].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 20),
    [feedback]
  );

  // True when the screen differs from what residents currently see.
  const dirty = useMemo(() => {
    if (!published) return false;
    const timingsKey = (t: Record<string, string>) => MEALS.map((m) => (t[m] ?? '').trim()).join('|');
    return (
      menuKey(draft) !== menuKey(published.draft) ||
      timingsKey(timings) !== timingsKey(published.timings) ||
      note.trim() !== (published.note ?? '').trim()
    );
  }, [draft, timings, note, published]);

  // Leaving the screen with unpublished changes asks first.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!dirty) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have menu changes that are not published yet.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty]);

  const setItems = (meal: string, value: string) =>
    setDraft((p) => ({ ...p, [day]: { ...(p[day] ?? {}), [meal]: value } }));

  const copyToAll = () =>
    Alert.alert(
      'Copy to all days',
      `Use ${day}'s menu for every day of the week? The other days' menus are replaced on this screen. You can undo it before you publish.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: () => {
            setBeforeCopy(clone(draft)); // keep the day-wise menu so Undo can bring it back
            setDraft((p) => {
              const next: Draft = {};
              (weekDays as string[]).forEach((d) => (next[d] = { ...(p[day] ?? {}) }));
              return next;
            });
          },
        },
      ]
    );

  const undoCopy = () => {
    if (!beforeCopy) return;
    setDraft(beforeCopy);
    setBeforeCopy(null);
  };

  const resetToPublished = () => {
    if (!published) return;
    Alert.alert('Reset to published menu', 'All changes you have not published will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setDraft(clone(published.draft));
          setTimings(clone(published.timings));
          setNote(published.note);
          setBeforeCopy(null);
        },
      },
    ]);
  };

  const save = () => {
    if (!activePropertyId) return;
    const days: Record<string, Record<string, string[]>> = {};
    (weekDays as string[]).forEach((d) => {
      days[d] = {};
      MEALS.forEach((m) => {
        days[d][m] = (draft[d]?.[m] ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
      });
    });
    setDoc(doc(db, 'foodMenus', activePropertyId), {
      propertyId: activePropertyId,
      days,
      timings,
      note: note.trim(),
      updatedAt: Date.now(),
    })
      .then(() => {
        // This is now the published menu: Reset goes back to it, and an old Undo no longer applies.
        setPublished({ draft: clone(draft), timings: clone(timings), note: note.trim() });
        setBeforeCopy(null);
        Alert.alert('Published', 'Residents will see the new menu right away.');
      })
      .catch((e: any) => Alert.alert('Could not save', e?.code ?? 'Please try again.'));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Food Menu</Text>
          {!!activeProperty?.name && (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{activeProperty.name}</Text>
          )}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {dirty && (
          <View style={styles.dirtyBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={[typography.caption, { color: colors.text, marginLeft: 8, flex: 1 }]}>
              You have changes that are not published yet.
            </Text>
            <TouchableOpacity onPress={resetToPublished} activeOpacity={0.8} hitSlop={8}>
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[typography.bodyBold, styles.label]}>Special announcement (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          placeholder="e.g., Special dinner on Sunday for Diwali"
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Serving timings</Text>
        {MEALS.map((m) => (
          <View key={m} style={styles.timeRow}>
            <Text style={[typography.body, { color: colors.text, width: 90 }]}>{m}</Text>
            <TextInput
              style={[styles.input, { flex: 1, padding: spacing.sm }]}
              value={timings[m]}
              onChangeText={(v) => setTimings((p) => ({ ...p, [m]: v }))}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Menu for</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.sm }}>
          {(weekDays as string[]).map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setDay(d)}
              activeOpacity={0.8}
              style={[styles.chip, day === d && styles.chipActive]}
            >
              <Text style={[typography.caption, { color: day === d ? colors.white : colors.text, fontWeight: '600' }]}>
                {d.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {MEALS.map((m) => (
          <View key={m} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>
              {m.toUpperCase()} — one item per line
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              value={draft[day]?.[m] ?? ''}
              onChangeText={(v) => setItems(m, v)}
              multiline
              placeholder="Idli&#10;Sambar&#10;Chutney"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}

        <View style={styles.actionRow}>
          <TouchableOpacity onPress={copyToAll} style={styles.secondaryButton} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '600', marginLeft: 6 }]}>
              Copy {day} to all days
            </Text>
          </TouchableOpacity>

          {!!beforeCopy && (
            <TouchableOpacity onPress={undoCopy} style={styles.undoButton} activeOpacity={0.8}>
              <Ionicons name="arrow-undo-outline" size={16} color={colors.warning} />
              <Text style={[typography.caption, { color: colors.warning, fontWeight: '700', marginLeft: 6 }]}>
                Undo copy
              </Text>
            </TouchableOpacity>
          )}

          {dirty && (
            <TouchableOpacity onPress={resetToPublished} style={styles.resetButton} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={16} color={colors.error} />
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 6 }]}>
                Reset to published
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={save}
          disabled={!loaded}
          activeOpacity={0.85}
          style={[styles.saveButton, !loaded && { backgroundColor: colors.border }]}
        >
          <Text style={[typography.button, { color: colors.white }]}>Publish Menu</Text>
        </TouchableOpacity>

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.xl }]}>
          Resident feedback ({feedback.length})
        </Text>
        {recent.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>No feedback yet.</Text>
        ) : (
          recent.map((f) => (
            <View key={f.id} style={styles.feedbackCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                  {f.kind === 'Quality' ? 'Food Quality' : f.kind} · {f.residentName ?? 'Resident'}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {new Date(f.createdAt ?? 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>{f.text}</Text>
            </View>
          ))
        )}
      </ScrollView>
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
  content: { padding: spacing.md, paddingBottom: 60 },
  label: { color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dirtyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  secondaryButton: { flexDirection: 'row', alignItems: 'center' },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});