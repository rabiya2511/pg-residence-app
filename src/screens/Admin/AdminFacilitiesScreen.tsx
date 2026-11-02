import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getFirestore, doc, onSnapshot, setDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { FACILITY_SECTIONS, WifiRow, EmergencyRow } from '../../hooks/useFacilities';

// A 10-digit mobile/landline number, or a 3-digit emergency code such as 100, 108 or 112.
const validPhone = (p: string) => /^\d{10}$/.test(p) || /^\d{3}$/.test(p);

export default function AdminFacilitiesScreen() {
  const navigation = useNavigation<any>();
  const { activePropertyId, activeProperty } = useAdmin();
  const db = getFirestore();

  const [saved, setSaved] = useState<Record<string, any> | null>(null); // what is published right now
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  const [texts, setTexts] = useState<Record<string, string>>({});
  const [wifi, setWifi] = useState<WifiRow[]>([]);
  const [emergency, setEmergency] = useState<EmergencyRow[]>([]);

  // Live copy of the published facilities (never touches the form while editing).
  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    setSaved(null);
    if (!activePropertyId) return;
    return onSnapshot(
      doc(db, 'facilities', activePropertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        const d = exists ? snap.data() : null;
        setSaved(d);
        setLoaded(true);
      },
      (e: any) => console.warn('admin facilities listener:', e?.code)
    );
  }, [activePropertyId]);

  const hasContent = (d: Record<string, any> | null) =>
    !!d &&
    ((d.wifi ?? []).length > 0 ||
      (d.emergency ?? []).length > 0 ||
      FACILITY_SECTIONS.some((s) => !!(d[s.key] ?? '').toString().trim()));

  // Open the form filled with what is currently published.
  const startEditing = () => {
    const t: Record<string, string> = {};
    FACILITY_SECTIONS.forEach((s) => (t[s.key] = saved?.[s.key] ?? ''));
    setTexts(t);
    setWifi((saved?.wifi ?? []).map((w: WifiRow) => ({ ...w })));
    setEmergency((saved?.emergency ?? []).map((e: EmergencyRow) => ({ ...e })));
    setEditing(true);
  };

  // First visit with nothing published: go straight to the form.
  useEffect(() => {
    if (loaded && !editing && !hasContent(saved)) startEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const save = () => {
    if (!activePropertyId) return;
    const badPhone = emergency.find((e) => e.phone.trim() && !validPhone(e.phone.trim()));
    if (badPhone) {
      Alert.alert('Check the phone number', `"${badPhone.label || 'Emergency contact'}" needs a 10-digit number.`);
      return;
    }
    const payload: Record<string, any> = {
      propertyId: activePropertyId,
      wifi: wifi.filter((w) => w.network.trim() || w.password.trim()).map((w) => ({ floor: w.floor.trim(), network: w.network.trim(), password: w.password.trim() })),
      emergency: emergency.filter((e) => e.phone.trim()).map((e) => ({ label: e.label.trim(), phone: e.phone.trim() })),
      updatedAt: Date.now(),
    };
    FACILITY_SECTIONS.forEach((s) => (payload[s.key] = (texts[s.key] ?? '').trim()));
    setDoc(doc(db, 'facilities', activePropertyId), payload)
      .then(() => {
        setSaved(payload); // show the published details straight away
        setEditing(false);
      })
      .catch((e: any) => Alert.alert('Could not save', e?.code ?? 'Please try again.'));
  };

  const call = (num: string) =>
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Cannot Call', `Please dial ${num} manually.`));

  const setWifiField = (i: number, k: keyof WifiRow, v: string) => setWifi((p) => p.map((w, j) => (j === i ? { ...w, [k]: v } : w)));
  const setEmField = (i: number, k: keyof EmergencyRow, v: string) => setEmergency((p) => p.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => (editing && hasContent(saved) ? setEditing(false) : navigation.goBack())} style={{ padding: spacing.xs }}>
        <Ionicons name={editing && hasContent(saved) ? 'close' : 'arrow-back'} size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Text style={[typography.heading3, { color: colors.text }]}>{editing ? 'Edit Facilities' : 'Facilities'}</Text>
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

  /* ------------------------------ published view ------------------------------ */
  if (!editing) {
    const wifiRows: WifiRow[] = (saved?.wifi ?? []).filter((w: WifiRow) => w.network || w.password);
    const emRows: EmergencyRow[] = (saved?.emergency ?? []).filter((e: EmergencyRow) => e.phone);
    const sections = FACILITY_SECTIONS.filter((s) => !!(saved?.[s.key] ?? '').toString().trim());
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <View style={styles.liveBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[typography.caption, { color: colors.text, marginLeft: spacing.xs, flex: 1 }]}>
              Published — residents of this property can see this now.
            </Text>
          </View>

          {wifiRows.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="wifi-outline" size={20} color={colors.primary} />
                <Text style={[typography.bodyBold, styles.cardTitle]}>Wi-Fi</Text>
              </View>
              {wifiRows.map((w, i) => (
                <View key={i} style={[{ paddingVertical: spacing.xs }, i > 0 && styles.divider]}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{w.floor || 'All floors'}</Text>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{w.network || '—'}</Text>
                  {!!w.password && <Text style={[typography.body, { color: colors.text }]}>Password: {w.password}</Text>}
                </View>
              ))}
            </View>
          )}

          {sections.map((s) => (
            <View key={s.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name={s.icon as any} size={20} color={colors.primary} />
                <Text style={[typography.bodyBold, styles.cardTitle]}>{s.label}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text }]}>{String(saved?.[s.key])}</Text>
            </View>
          ))}

          {emRows.length > 0 && (
            <View style={[styles.card, { borderColor: colors.error }]}>
              <View style={styles.cardHead}>
                <Ionicons name="call-outline" size={20} color={colors.error} />
                <Text style={[typography.bodyBold, styles.cardTitle]}>Emergency Contacts</Text>
              </View>
              {emRows.map((e, i) => (
                <TouchableOpacity key={i} style={styles.emRow} onPress={() => call(e.phone)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{e.label || 'Contact'}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{e.phone}</Text>
                  </View>
                  <Ionicons name="call" size={18} color={colors.error} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={startEditing} activeOpacity={0.85}>
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Edit Facilities</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ------------------------------ edit form ------------------------------ */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[typography.bodyBold, styles.label]}>Wi-Fi (per floor)</Text>
        {wifi.map((w, i) => (
          <View key={i} style={styles.group}>
            <View style={styles.rowBetween}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Floor (e.g., Floor 2)" placeholderTextColor={colors.textMuted} value={w.floor} onChangeText={(v) => setWifiField(i, 'floor', v)} />
              <TouchableOpacity onPress={() => setWifi((p) => p.filter((_, j) => j !== i))} style={{ padding: spacing.sm }}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { marginTop: spacing.xs }]} placeholder="Network name" placeholderTextColor={colors.textMuted} value={w.network} onChangeText={(v) => setWifiField(i, 'network', v)} autoCapitalize="none" />
            <TextInput style={[styles.input, { marginTop: spacing.xs }]} placeholder="Password" placeholderTextColor={colors.textMuted} value={w.password} onChangeText={(v) => setWifiField(i, 'password', v)} autoCapitalize="none" />
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setWifi((p) => [...p, { floor: '', network: '', password: '' }])}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '600', marginLeft: 4 }]}>Add Wi-Fi network</Text>
        </TouchableOpacity>

        {FACILITY_SECTIONS.map((s) => (
          <View key={s.key} style={{ marginTop: spacing.lg }}>
            <Text style={[typography.bodyBold, styles.label]}>{s.label}</Text>
            <TextInput
              style={[styles.input, { minHeight: 56, textAlignVertical: 'top' }]}
              placeholder={s.placeholder}
              placeholderTextColor={colors.textMuted}
              value={texts[s.key] ?? ''}
              onChangeText={(v) => setTexts((p) => ({ ...p, [s.key]: v }))}
              multiline
            />
          </View>
        ))}

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Emergency contacts</Text>
        {emergency.map((e, i) => (
          <View key={i} style={[styles.rowBetween, { marginBottom: spacing.xs }]}>
            <TextInput style={[styles.input, { flex: 1, marginRight: spacing.xs }]} placeholder="Label (e.g., Warden)" placeholderTextColor={colors.textMuted} value={e.label} onChangeText={(v) => setEmField(i, 'label', v)} />
            <TextInput
              style={[styles.input, { flex: 1 }, e.phone.length > 0 && !validPhone(e.phone) && { borderColor: colors.error }]}
              placeholder="10-digit phone"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
              value={e.phone}
              onChangeText={(v) => setEmField(i, 'phone', v.replace(/\D/g, ''))}
            />
            <TouchableOpacity onPress={() => setEmergency((p) => p.filter((_, j) => j !== i))} style={{ padding: spacing.sm }}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setEmergency((p) => [...p, { label: '', phone: '' }])}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '600', marginLeft: 4 }]}>Add emergency contact</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, !loaded && { backgroundColor: colors.border }]} onPress={save} disabled={!loaded} activeOpacity={0.85}>
          <Text style={[typography.button, { color: colors.white }]}>Save & Publish</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  label: { color: colors.text, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: 14, color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: spacing.xs },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
  liveBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { color: colors.text, marginLeft: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
  emRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
});