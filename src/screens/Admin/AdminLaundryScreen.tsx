import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
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
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { useAdminLaundry, LaundryRequest, LaundryStatus } from '../../hooks/useLaundry';
import { STATUS_STYLE } from '../Laundry/LaundryScreen';

type Tab = 'New' | 'Active' | 'Ready' | 'History';
const TABS: Tab[] = ['New', 'Active', 'Ready', 'History'];

const inTab = (t: Tab, s: LaundryStatus) =>
  t === 'New'
    ? s === 'Requested'
    : t === 'Active'
    ? s === 'Pickup Scheduled' || s === 'Collected' || s === 'Processing'
    : t === 'Ready'
    ? s === 'Ready'
    : s === 'Delivered' || s === 'Cancelled';

// The next step for each status.
const NEXT: Partial<Record<LaundryStatus, { to: LaundryStatus; label: string }>> = {
  Requested: { to: 'Pickup Scheduled', label: 'Schedule Pickup' },
  'Pickup Scheduled': { to: 'Collected', label: 'Mark Collected' },
  Collected: { to: 'Processing', label: 'Start Processing' },
  Processing: { to: 'Ready', label: 'Mark Ready' },
  Ready: { to: 'Delivered', label: 'Mark Delivered' },
};

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function AdminLaundryScreen() {
  const navigation = useNavigation<any>();
  const { activeProperty } = useAdmin();
  const { requests, loaded, update } = useAdminLaundry();

  const [tab, setTab] = useState<Tab>('New');
  const [busyId, setBusyId] = useState<string | null>(null);

  // edit details
  const [editId, setEditId] = useState<string | null>(null);
  const [charges, setCharges] = useState('');
  const [delivery, setDelivery] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const c = {} as Record<Tab, number>;
    TABS.forEach((t) => (c[t] = requests.filter((r) => inTab(t, r.status)).length));
    return c;
  }, [requests]);

  const shown = useMemo(() => requests.filter((r) => inTab(tab, r.status)), [requests, tab]);
  const editing = requests.find((r) => r.id === editId);

  // Delivery date options: today and the next 9 days.
  const deliveryOptions = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
          label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          display: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        };
      }),
    []
  );

  const advance = async (r: LaundryRequest) => {
    const next = NEXT[r.status];
    if (!next) return;
    setBusyId(r.id);
    const result = await update(r.id, r.status, {}, next.to);
    setBusyId(null);
    if (!result.ok) Alert.alert('Could Not Update', result.message ?? 'Please try again.');
  };

  const confirmCancel = (r: LaundryRequest) => {
    Alert.alert('Cancel Request', `Cancel ${r.residentName}'s laundry request?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          setBusyId(r.id);
          const result = await update(r.id, r.status, { cancelledAt: Date.now() }, 'Cancelled');
          setBusyId(null);
          if (!result.ok) Alert.alert('Could Not Update', result.message ?? 'Please try again.');
        },
      },
    ]);
  };

  const openEdit = (r: LaundryRequest) => {
    setCharges(r.charges !== null ? String(r.charges) : '');
    setDelivery(r.expectedDelivery);
    setPaid(r.paymentStatus === 'Paid');
    setRemarks(r.adminRemarks ?? '');
    setEditId(r.id);
  };

  const saveEdit = async () => {
    if (!editing || saving) return;
    const amount = charges.trim() === '' ? null : Number(charges);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      Alert.alert('Charges', 'Enter a valid amount, or leave it empty.');
      return;
    }
    if (paid && amount === null) {
      Alert.alert('Payment', 'Enter the charges before marking the request as paid.');
      return;
    }
    setSaving(true);
    const result = await update(editing.id, editing.status, {
      charges: amount,
      expectedDelivery: delivery,
      paymentStatus: paid ? 'Paid' : 'Unpaid',
      adminRemarks: remarks.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert('Could Not Save', result.message ?? 'Please try again.');
      return;
    }
    setEditId(null);
  };

  const renderItem = ({ item: r }: { item: LaundryRequest }) => {
    const s = STATUS_STYLE[r.status];
    const next = NEXT[r.status];
    const busy = busyId === r.id;
    const final = r.status === 'Delivered' || r.status === 'Cancelled';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {r.residentName} · Room {r.room}
          </Text>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[typography.caption, { color: s.fg, fontWeight: '700' }]}>{r.status}</Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {r.serviceType} · {r.numClothes} clothes
        </Text>
        <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>
          Pickup {r.pickupDate}, {r.pickupSlot}
        </Text>
        {!!r.expectedDelivery && (
          <Text style={[typography.caption, { color: colors.text, marginTop: 2 }]}>Delivery {r.expectedDelivery}</Text>
        )}
        {r.charges !== null && (
          <Text style={[typography.caption, { color: colors.text, marginTop: 2 }]}>
            Charges {formatINR(r.charges)} ·{' '}
            <Text style={{ color: r.paymentStatus === 'Paid' ? colors.success : colors.error, fontWeight: '700' }}>
              {r.paymentStatus}
            </Text>
          </Text>
        )}
        {!!r.notes && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Note: {r.notes}</Text>}
        {!!r.adminRemarks && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Remarks: {r.adminRemarks}</Text>
        )}
        {!!r.imageUrl && <Image source={{ uri: r.imageUrl }} style={styles.photo} />}

        {busy ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
        ) : (
          <View style={styles.actions}>
            {next && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => advance(r)}>
                <Text style={[typography.caption, styles.btnText]}>{next.label}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => openEdit(r)}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Edit Details</Text>
            </TouchableOpacity>
            {!final && (
              <TouchableOpacity style={[styles.btn, styles.btnOutline, { borderColor: colors.error }]} onPress={() => confirmCancel(r)}>
                <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Laundry Requests</Text>
          {!!activeProperty?.name && <Text style={[typography.caption, { color: colors.textMuted }]}>{activeProperty.name}</Text>}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} style={[styles.chip, tab === t && styles.chipActive]} onPress={() => setTab(t)}>
              <Text style={[typography.caption, { color: tab === t ? colors.white : colors.text, fontWeight: '600' }]}>
                {t} ({counts[t]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shirt-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No {tab.toLowerCase()} laundry requests.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ---------------- Edit details ---------------- */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => !saving && setEditId(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={[typography.heading3, { color: colors.text }]}>Laundry details</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {editing?.residentName} · {editing?.serviceType}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[typography.caption, styles.label]}>Charges (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={charges}
                  onChangeText={(t) => setCharges(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 150"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />

                <Text style={[typography.caption, styles.label]}>Expected delivery</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                  {deliveryOptions.map((d) => (
                    <TouchableOpacity
                      key={d.display}
                      style={[styles.chip, delivery === d.display && styles.chipActive]}
                      onPress={() => setDelivery(delivery === d.display ? null : d.display)}
                    >
                      <Text style={[typography.caption, { color: delivery === d.display ? colors.white : colors.text, fontWeight: '600' }]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[typography.caption, styles.label]}>Payment</Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {[false, true].map((v) => (
                    <TouchableOpacity key={String(v)} style={[styles.chip, paid === v && styles.chipActive]} onPress={() => setPaid(v)}>
                      <Text style={[typography.caption, { color: paid === v ? colors.white : colors.text, fontWeight: '600' }]}>
                        {v ? 'Paid' : 'Unpaid'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[typography.caption, styles.label]}>Remarks (the resident sees this)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="e.g. Two shirts need dry clean"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                <View style={styles.sheetButtons}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setEditId(null)} disabled={saving}>
                    <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }, saving && { opacity: 0.7 }]} onPress={saveEdit} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.white} /> : <Text style={[typography.caption, styles.btnText]}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  chipRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.xs },
  photo: { width: 72, height: 72, borderRadius: radius.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  btnText: { color: colors.white, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, maxHeight: '90%' },
  label: { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  sheetButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});