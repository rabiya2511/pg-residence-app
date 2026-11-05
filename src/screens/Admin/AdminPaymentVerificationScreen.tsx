import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
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
import { useAdminUpiPayments, useUpiSettings } from '../../hooks/useUpiPayments';
import { UpiPayment, fmtWhen, upiStatusColor } from '../../utils/upiPayments';

type Tab = 'pending' | 'done';
const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function AdminPaymentVerificationScreen() {
  const navigation = useNavigation<any>();
  const { activePropertyId } = useAdmin();
  const { payments, pending, confirm, reject } = useAdminUpiPayments();
  const { settings, lateFeeRules, save, saveLateFee } = useUpiSettings(activePropertyId);

  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // UPI details editor
  const [setupOpen, setSetupOpen] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [feeOn, setFeeOn] = useState(false);
  const [feePerDay, setFeePerDay] = useState('50');
  const [feeCap, setFeeCap] = useState('500');
  const [feeGrace, setFeeGrace] = useState('0');

  // Reject dialog
  const [rejecting, setRejecting] = useState<UpiPayment | null>(null);
  const [reason, setReason] = useState('');

  const done = useMemo(() => payments.filter((p) => p.status !== 'Under Verification'), [payments]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tab === 'pending' ? pending : done).filter(
      (p) =>
        !q ||
        p.residentName.toLowerCase().includes(q) ||
        p.upiRef.includes(q) ||
        (p.room ?? '').toLowerCase().includes(q)
    );
  }, [tab, pending, done, search]);

  const openSetup = () => {
    setUpiId(settings.upiId);
    setPayeeName(settings.payeeName);
    setFeeOn(lateFeeRules.perDay > 0);
    setFeePerDay(String(lateFeeRules.perDay || 50));
    setFeeCap(String(lateFeeRules.cap || 500));
    setFeeGrace(String(lateFeeRules.graceDays || 0));
    setSetupOpen(true);
  };

  const saveSetup = async () => {
    // The UPI details are optional here: skip them when both are empty and only the late fee is being changed.
    if (upiId.trim() || payeeName.trim() || settings.upiId) {
      const res = await save(upiId, payeeName);
      if (!res.ok) {
        Alert.alert('Not saved', res.message);
        return;
      }
    }
    const fee = await saveLateFee({
      perDay: feeOn ? Number(feePerDay) || 0 : 0,
      cap: feeOn ? Number(feeCap) || 0 : 0,
      graceDays: feeOn ? Number(feeGrace) || 0 : 0,
    });
    if (fee.ok) setSetupOpen(false);
    else Alert.alert('Not saved', fee.message);
  };

  const askConfirm = (p: UpiPayment) =>
    Alert.alert(
      'Confirm payment?',
      `Check your bank / UPI app first:\n\n${p.residentName}${p.room ? ` (Room ${p.room})` : ''}\n${inr(p.amount)} for ${p.month}\nUPI reference ${p.upiRef}\n\nOnly confirm if this exact amount and reference are in your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, money received',
          onPress: async () => {
            setBusyId(p.id);
            const res = await confirm(p);
            setBusyId(null);
            if (!res.ok) Alert.alert('Could not confirm', res.message);
          },
        },
      ]
    );

  const submitReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const res = await reject(rejecting, reason);
    setBusyId(null);
    if (res.ok) {
      setRejecting(null);
      setReason('');
    } else {
      Alert.alert('Could not reject', res.message);
    }
  };

  const header = (
    <View>
      <View style={styles.upiCard}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Residents pay to</Text>
          {settings.upiId ? (
            <>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{settings.upiId}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{settings.payeeName}</Text>
            </>
          ) : (
            <Text style={[typography.body, { color: colors.error }]}>Not set up yet</Text>
          )}
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={openSetup} activeOpacity={0.85}>
          <Ionicons name={settings.upiId ? 'create-outline' : 'add-circle-outline'} size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>
            {settings.upiId ? 'Edit' : 'Set up'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {([
          { key: 'pending', label: `Pending (${pending.length})` },
          { key: 'done', label: `Reviewed (${done.length})` },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabOn]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.85}
          >
            <Text style={[typography.caption, { color: tab === t.key ? colors.white : colors.text, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, room or reference..."
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading2, { color: colors.text, flex: 1 }]}>Verify Payments</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            {tab === 'pending' ? 'Nothing waiting for verification.' : 'No reviewed payments yet.'}
          </Text>
        }
        renderItem={({ item: p }) => {
          const sc = upiStatusColor(p.status);
          const busy = busyId === p.id;
          return (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{p.residentName}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {p.room ? `Room ${p.room} · ` : ''}
                    {p.month}
                    {p.lateFee ? ` · incl. late fee ${inr(p.lateFee)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.heading3, { color: colors.text }]}>{inr(p.amount)}</Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[typography.caption, { color: sc.text, fontWeight: '700' }]}>{p.status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.refBox}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>UPI reference</Text>
                <Text style={[typography.bodyBold, { color: colors.text, letterSpacing: 1 }]} selectable>
                  {p.upiRef}
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                Sent {fmtWhen(p.submittedAt)}
                {p.reviewedAt ? ` · Reviewed ${fmtWhen(p.reviewedAt)}` : ''}
              </Text>
              {!!p.reviewNote && (
                <Text style={[typography.caption, { color: colors.error, marginTop: 2 }]}>Reason: {p.reviewNote}</Text>
              )}

              {p.status === 'Under Verification' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={() => {
                      setReason('');
                      setRejecting(p);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[typography.button, { color: colors.error }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={() => askConfirm(p)}
                    activeOpacity={0.85}
                  >
                    <Text style={[typography.button, { color: colors.white }]}>Confirm received</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Where residents pay */}
      <Modal visible={setupOpen} transparent animationType="fade" onRequestClose={() => setSetupOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.rowBetween}>
                <Text style={[typography.heading3, { color: colors.text }]}>UPI details</Text>
                <TouchableOpacity onPress={() => setSetupOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                Residents of this PG will see these details (and a QR code) when they pay rent.
              </Text>
              <Text style={styles.label}>UPI ID</Text>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g. lokanshpg@okhdfcbank"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.label}>Name on the account</Text>
              <TextInput
                style={styles.input}
                value={payeeName}
                onChangeText={setPayeeName}
                placeholder="e.g. Lokansh Aditya PG"
                placeholderTextColor={colors.textMuted}
              />
              <View style={[styles.rowBetween, { marginTop: spacing.lg }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>Charge a late fee</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Added to rent that is paid after the due date. You can waive it for any resident.
                  </Text>
                </View>
                <Switch
                  value={feeOn}
                  onValueChange={setFeeOn}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.white}
                />
              </View>
              {feeOn && (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {([
                    { label: '₹ per day', v: feePerDay, set: setFeePerDay },
                    { label: 'Max per month ₹', v: feeCap, set: setFeeCap },
                    { label: 'Grace days', v: feeGrace, set: setFeeGrace },
                  ] as const).map((f) => (
                    <View key={f.label} style={{ flex: 1 }}>
                      <Text style={styles.label}>{f.label}</Text>
                      <TextInput
                        style={styles.input}
                        value={f.v}
                        onChangeText={(t) => f.set(t.replace(/[^\d]/g, ''))}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.saveBtn} onPress={saveSetup} activeOpacity={0.85}>
                <Text style={[typography.button, { color: colors.white }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Why a payment is rejected */}
      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.rowBetween}>
                <Text style={[typography.heading3, { color: colors.text }]}>Reject payment</Text>
                <TouchableOpacity onPress={() => setRejecting(null)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {rejecting && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  {rejecting.residentName} · {inr(rejecting.amount)} · ref {rejecting.upiRef}
                </Text>
              )}
              <Text style={styles.label}>Reason (the resident will see this)</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Amount not received / wrong reference number"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.error }]}
                onPress={submitReject}
                activeOpacity={0.85}
              >
                <Text style={[typography.button, { color: colors.white }]}>Reject payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  backButton: { padding: spacing.xs, marginRight: spacing.xs },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  upiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  refBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  rejectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.sm,
  },
  confirmBtn: {
    flex: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
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
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
});
