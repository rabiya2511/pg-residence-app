import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getFirestore, collection, doc, onSnapshot, query, where, setDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { RULE_SECTIONS, RulesDoc } from '../../hooks/useRules';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function AdminRulesScreen() {
  const navigation = useNavigation<any>();
  const { activePropertyId, activeProperty, residents } = useAdmin();
  const db = getFirestore();

  const [saved, setSaved] = useState<RulesDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [requireAck, setRequireAck] = useState(true);
  const [acks, setAcks] = useState<any[]>([]);

  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    setSaved(null);
    if (!activePropertyId) return;
    return onSnapshot(
      doc(db, 'rules', activePropertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setSaved(exists ? (snap.data() as RulesDoc) : null);
        setLoaded(true);
      },
      (e: any) => console.warn('admin rules listener:', e?.code)
    );
  }, [activePropertyId]);

  useEffect(() => {
    if (!activePropertyId) return;
    return onSnapshot(
      query(collection(db, 'ruleAcks'), where('propertyId', '==', activePropertyId)),
      (snap: any) => setAcks(snap.docs.map((d: any) => d.data())),
      (e: any) => console.warn('admin rule acks listener:', e?.code)
    );
  }, [activePropertyId]);

  const hasContent = !!saved && RULE_SECTIONS.some((s) => !!(saved[s.key] ?? '').toString().trim());

  const startEditing = () => {
    const t: Record<string, string> = {};
    RULE_SECTIONS.forEach((s) => (t[s.key] = saved?.[s.key] ?? ''));
    setTexts(t);
    setRequireAck(true);
    setEditing(true);
  };

  // Nothing published yet: open the form straight away.
  useEffect(() => {
    if (loaded && !editing && !hasContent) startEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const ackedCount = useMemo(
    () => (saved ? acks.filter((a) => (a.version ?? 0) >= (saved.version ?? 1)).length : 0),
    [acks, saved]
  );
  const totalResidents = residents.length;

  const save = () => {
    if (!activePropertyId) return;
    const payload: Record<string, any> = {
      propertyId: activePropertyId,
      // A new version asks every resident to acknowledge again.
      version: (saved?.version ?? 0) === 0 ? 1 : (saved!.version ?? 1) + (requireAck ? 1 : 0),
      updatedAt: Date.now(),
    };
    RULE_SECTIONS.forEach((s) => (payload[s.key] = (texts[s.key] ?? '').trim()));
    setDoc(doc(db, 'rules', activePropertyId), payload)
      .then(() => {
        setSaved(payload as RulesDoc);
        setEditing(false);
      })
      .catch((e: any) => Alert.alert('Could not save', e?.code ?? 'Please try again.'));
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => (editing && hasContent ? setEditing(false) : navigation.goBack())} style={{ padding: spacing.xs }}>
        <Ionicons name={editing && hasContent ? 'close' : 'arrow-back'} size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Text style={[typography.heading3, { color: colors.text }]}>{editing ? 'Edit Rules' : 'Rules & Regulations'}</Text>
        {!!activeProperty?.name && <Text style={[typography.caption, { color: colors.textMuted }]}>{activeProperty.name}</Text>}
      </View>
      {!editing && loaded ? (
        <TouchableOpacity onPress={startEditing} style={{ padding: spacing.xs }}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 30 }} />
      )}
    </View>
  );

  if (!editing) {
    const sections = RULE_SECTIONS.filter((s) => !!(saved?.[s.key] ?? '').toString().trim());
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {!!saved && (
            <View style={styles.statCard}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>
                Version {saved.version ?? 1} · updated {fmtDate(saved.updatedAt)}
              </Text>
              <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>
                {ackedCount} of {totalResidents} residents have acknowledged
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${totalResidents ? Math.min(100, (ackedCount / totalResidents) * 100) : 0}%` }]} />
              </View>
            </View>
          )}

          {sections.map((s) => (
            <View key={s.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name={s.icon as any} size={20} color={colors.primary} />
                <Text style={[typography.bodyBold, { color: colors.text, marginLeft: spacing.sm }]}>{s.label}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text }]}>{String(saved?.[s.key])}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.primaryBtn} onPress={startEditing} activeOpacity={0.85}>
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Edit Rules</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {RULE_SECTIONS.map((s, i) => (
          <View key={s.key} style={{ marginTop: i === 0 ? 0 : spacing.lg }}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>{s.label}</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder={s.placeholder}
              placeholderTextColor={colors.textMuted}
              value={texts[s.key] ?? ''}
              onChangeText={(v) => setTexts((p) => ({ ...p, [s.key]: v }))}
              multiline
            />
          </View>
        ))}

        {!!saved && (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text }]}>Ask residents to acknowledge again</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Turn on for important changes. Residents see an "updated" notice.</Text>
            </View>
            <Switch value={requireAck} onValueChange={setRequireAck} trackColor={{ true: colors.primary }} />
          </View>
        )}

        <TouchableOpacity style={[styles.primaryBtn, !loaded && { backgroundColor: colors.border }]} onPress={save} disabled={!loaded} activeOpacity={0.85}>
          <Text style={[typography.button, { color: colors.white }]}>Save & Publish</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  statCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, padding: spacing.md, marginBottom: spacing.md },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginTop: spacing.sm },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
});