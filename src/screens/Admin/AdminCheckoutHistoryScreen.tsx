import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { buildStatementHtml } from '../../utils/settlementStatement';

const formatINR = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const formatDisplayDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_LOOK: Record<string, { bg: string; fg: string }> = {
  'Refund Pending': { bg: '#FEF3C7', fg: '#92400E' },
  Refunded: { bg: '#D1FAE5', fg: colors.success },
  'Amount Owed': { bg: '#FEE2E2', fg: colors.error },
  'Dues Received': { bg: '#D1FAE5', fg: colors.success },
  Settled: { bg: '#E5E7EB', fg: colors.text },
};

type Filter = 'All' | 'Refund Pending' | 'Amount Owed' | 'Closed';
const FILTERS: Filter[] = ['All', 'Refund Pending', 'Amount Owed', 'Closed'];
const PAY_METHODS = ['UPI', 'Cash', 'Bank Transfer'];

const isClosed = (status: string) => status === 'Refunded' || status === 'Dues Received' || status === 'Settled';

function Row({ label, value, negative, bold, plus }: { label: string; value: string; negative?: boolean; bold?: boolean; plus?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[bold ? typography.bodyBold : typography.body, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Text style={[bold ? typography.bodyBold : typography.body, { color: negative ? colors.error : colors.text, marginLeft: spacing.sm }]}>
        {plus ? '+ ' : negative ? '− ' : ''}
        {value}
      </Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function AdminCheckoutHistoryScreen() {
  const navigation = useNavigation<any>();
  const { archivedResidents, rooms, properties } = useAdmin();
  const db = getFirestore();

  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // payment form
  const [payMode, setPayMode] = useState<'refund' | 'dues' | null>(null);
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0]);
  const [payRef, setPayRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Only residents who went through the checkout have a settlement on their record.
  const records = useMemo(
    () =>
      archivedResidents
        .filter((r: any) => !!r.exitSettlement)
        .map((r: any) => ({ r, s: r.exitSettlement }))
        .sort((a, b) => (b.s.completedAt ?? 0) - (a.s.completedAt ?? 0)),
    [archivedResidents]
  );

  const roomNumber = (roomId: string) => rooms.find((x) => x.id === roomId)?.roomNumber ?? '—';
  const propertyName = (propertyId: string) => properties.find((p) => p.id === propertyId)?.name ?? 'Unknown Property';

  const counts = useMemo(
    () => ({
      All: records.length,
      'Refund Pending': records.filter((x) => x.s.status === 'Refund Pending').length,
      'Amount Owed': records.filter((x) => x.s.status === 'Amount Owed').length,
      Closed: records.filter((x) => isClosed(x.s.status)).length,
    }),
    [records]
  );
  const refundDue = records.filter((x) => x.s.status === 'Refund Pending').reduce((sum, x) => sum + (Number(x.s.refund) || 0), 0);
  const owedTotal = records.filter((x) => x.s.status === 'Amount Owed').reduce((sum, x) => sum + (Number(x.s.amountOwed) || 0), 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(({ r, s }) => {
      if (filter === 'Closed' ? !isClosed(s.status) : filter !== 'All' && s.status !== filter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || roomNumber(r.roomId).toLowerCase().includes(q);
    });
  }, [records, filter, search, rooms]);

  const selected = records.find((x) => x.r.id === selectedId);

  const closeDetail = () => {
    if (busy || pdfBusy) return;
    setSelectedId(null);
    setPayMode(null);
    setPayRef('');
    setPayMethod(PAY_METHODS[0]);
  };

  const failMessage = (e: any) =>
    e?.code === 'firestore/permission-denied'
      ? 'Not allowed. Publish the latest Firestore rules and try again.'
      : e?.code === 'timeout'
      ? 'This is taking too long. Check your connection and try again.'
      : 'Check your connection and try again.';

  const savePayment = () => {
    if (!selected || !payMode) return;
    const { r, s } = selected;
    const isRefund = payMode === 'refund';
    const amount = isRefund ? s.refund : s.amountOwed;
    Alert.alert(
      isRefund ? 'Mark Refund Paid' : 'Mark Dues Received',
      `${formatINR(amount)} ${isRefund ? 'refunded to' : 'received from'} ${r.name} by ${payMethod}?`,
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBusy(true);
            try {
              const today = formatDisplayDate(new Date());
              const changes = isRefund
                ? {
                    'exitSettlement.status': 'Refunded',
                    'exitSettlement.refundPaidOn': today,
                    'exitSettlement.refundPaidAt': Date.now(),
                    'exitSettlement.refundMethod': payMethod,
                    'exitSettlement.refundReference': payRef.trim() || null,
                  }
                : {
                    'exitSettlement.status': 'Dues Received',
                    'exitSettlement.duesReceivedOn': today,
                    'exitSettlement.duesReceivedAt': Date.now(),
                    'exitSettlement.duesMethod': payMethod,
                    'exitSettlement.duesReference': payRef.trim() || null,
                  };
              await Promise.race([
                updateDoc(doc(db, 'residents', r.id), changes),
                new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 10000)),
              ]);
              setPayMode(null);
              setPayRef('');
            } catch (e: any) {
              console.warn('settlement payment failed:', e?.code ?? e?.message);
              Alert.alert('Could Not Save', failMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const downloadStatement = async () => {
    if (!selected) return;
    const { r, s } = selected;
    setPdfBusy(true);
    try {
      const html = buildStatementHtml({
        propertyName: propertyName(r.propertyId),
        residentName: r.name,
        phone: r.phone,
        roomNumber: roomNumber(r.roomId),
        joiningDate: r.joiningDate,
        noticeSubmittedOn: r.vacateSubmittedAt ? formatDisplayDate(new Date(Number(r.vacateSubmittedAt))) : null,
        expectedCheckout: r.vacatingDate ?? null,
        reason: r.vacateReason ?? null,
        settlement: s,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Settlement statement - ${r.name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Statement Created', `Saved to: ${uri}`);
      }
    } catch (e: any) {
      console.warn('statement failed:', e?.message ?? e);
      Alert.alert('Could Not Create Statement', 'The PDF could not be created on this device. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const renderItem = ({ item }: { item: { r: any; s: any } }) => {
    const { r, s } = item;
    const look = STATUS_LOOK[s.status] ?? STATUS_LOOK.Settled;
    const owes = Number(s.amountOwed) > 0;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setSelectedId(r.id)}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            Room {roomNumber(r.roomId)} · {propertyName(r.propertyId)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            Checked out {s.completedOn ?? '—'}
          </Text>
          <View style={[styles.chip, { backgroundColor: look.bg }]}>
            <Text style={[typography.caption, { color: look.fg, fontWeight: '700' }]}>{s.status}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{owes ? 'Owes' : 'Refund'}</Text>
          <Text style={[typography.heading3, { color: owes ? colors.error : colors.text }]}>
            {formatINR(owes ? s.amountOwed : s.refund)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Checkout History</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>REFUNDS TO PAY</Text>
          <Text style={[typography.bodyBold, { color: colors.warning }]}>{formatINR(refundDue)}</Text>
          <Text style={styles.summarySub}>{counts['Refund Pending']} resident(s)</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>DUES TO COLLECT</Text>
          <Text style={[typography.bodyBold, { color: colors.error }]}>{formatINR(owedTotal)}</Text>
          <Text style={styles.summarySub}>{counts['Amount Owed']} resident(s)</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or room..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity key={f} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(f)}>
              <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '700' }]}>
                {f} ({counts[f]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            {records.length === 0
              ? 'No completed checkouts yet. Residents appear here after you complete their checkout.'
              : 'No checkouts match this filter.'}
          </Text>
        }
      />

      {/* ---------------- Detail / settlement statement ---------------- */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeDetail}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              {selected && (() => {
                const { r, s } = selected;
                const look = STATUS_LOOK[s.status] ?? STATUS_LOOK.Settled;
                const owes = Number(s.amountOwed) > 0;
                const items: { month: string; amount: number }[] = Array.isArray(s.pendingRentItems) ? s.pendingRentItems : [];
                const decisionOn = r.exitDecision?.at ? formatDisplayDate(new Date(Number(r.exitDecision.at))) : null;
                return (
                  <>
                    <View style={styles.sheetHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          Room {roomNumber(r.roomId)} · {propertyName(r.propertyId)}
                        </Text>
                      </View>
                      <View style={[styles.chip, { backgroundColor: look.bg, marginTop: 0, marginRight: spacing.sm }]}>
                        <Text style={[typography.caption, { color: look.fg, fontWeight: '700' }]}>{s.status}</Text>
                      </View>
                      <TouchableOpacity onPress={closeDetail}>
                        <Ionicons name="close" size={22} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      <Text style={[typography.caption, styles.label]}>Exit notice log</Text>
                      <View style={styles.box}>
                        <InfoLine label="Notice submitted" value={r.vacateSubmittedAt ? formatDisplayDate(new Date(Number(r.vacateSubmittedAt))) : null} />
                        <InfoLine label="Expected checkout" value={r.vacatingDate} />
                        <InfoLine
                          label="Notice period"
                          value={s.noticeDays !== null && s.noticeDays !== undefined ? `${s.noticeDays} of ${s.requiredNoticeDays ?? 30} days` : null}
                        />
                        <InfoLine label="Approved on" value={decisionOn} />
                        <InfoLine label="Checked out on" value={s.completedOn} />
                        <InfoLine label="Reason" value={r.vacateReason} />
                        <InfoLine label="Remarks" value={r.vacateRemarks} />
                      </View>

                      <Text style={[typography.caption, styles.label]}>Final settlement</Text>
                      <View style={styles.box}>
                        <Row label="Security deposit" value={formatINR(s.deposit)} />
                        {Number(s.advanceCredit) > 0 && <Row label="Advance balance returned" value={formatINR(s.advanceCredit)} plus />}
                        {Number(s.emergencyDeduction) > 0 && (
                          <Row label={`Emergency deduction (${s.emergencyPercent}%)`} value={formatINR(s.emergencyDeduction)} negative />
                        )}
                        {Number(s.pendingRent) > 0 && <Row label="Pending rent" value={formatINR(s.pendingRent)} negative />}
                        {items.map((i, idx) => (
                          <Text key={`${i.month}-${idx}`} style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                            {i.month} · {formatINR(i.amount)}
                          </Text>
                        ))}
                        {Number(s.pendingMaintenance) > 0 && <Row label="Pending maintenance" value={formatINR(s.pendingMaintenance)} negative />}
                        {Number(s.additionalDeductions) > 0 && (
                          <Row
                            label={`Other deductions${s.additionalNote ? ` (${s.additionalNote})` : ''}`}
                            value={formatINR(s.additionalDeductions)}
                            negative
                          />
                        )}
                        <View style={styles.divider} />
                        {owes ? (
                          <Row label="Resident owes" value={formatINR(s.amountOwed)} negative bold />
                        ) : (
                          <Row label="Refundable amount" value={formatINR(s.refund)} bold />
                        )}
                      </View>

                      <Text style={[typography.caption, styles.label]}>Clearance</Text>
                      <View style={styles.box}>
                        {[
                          ['Room inspection completed', s.roomInspection],
                          ['Keys and belongings returned', s.keysReturned],
                          ['Pending dues reviewed', s.duesReviewed],
                        ].map(([label, ok]) => (
                          <View key={String(label)} style={styles.row}>
                            <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={18} color={ok ? colors.success : colors.error} />
                            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>{String(label)}</Text>
                          </View>
                        ))}
                      </View>

                      {s.status === 'Refunded' && (
                        <View style={[styles.box, { marginTop: spacing.sm }]}>
                          <InfoLine label="Refund paid on" value={s.refundPaidOn} />
                          <InfoLine label="Method" value={s.refundMethod} />
                          <InfoLine label="Reference" value={s.refundReference} />
                        </View>
                      )}
                      {s.status === 'Dues Received' && (
                        <View style={[styles.box, { marginTop: spacing.sm }]}>
                          <InfoLine label="Dues received on" value={s.duesReceivedOn} />
                          <InfoLine label="Method" value={s.duesMethod} />
                          <InfoLine label="Reference" value={s.duesReference} />
                        </View>
                      )}

                      {/* Mark paid form */}
                      {payMode && (
                        <View style={[styles.box, { marginTop: spacing.sm }]}>
                          <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.xs }]}>
                            {payMode === 'refund' ? `Refund ${formatINR(s.refund)}` : `Collect ${formatINR(s.amountOwed)}`}
                          </Text>
                          <View style={styles.methodRow}>
                            {PAY_METHODS.map((m) => {
                              const active = m === payMethod;
                              return (
                                <TouchableOpacity key={m} style={[styles.methodChip, active && styles.methodChipActive]} onPress={() => setPayMethod(m)}>
                                  <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '700' }]}>{m}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          <TextInput
                            style={styles.input}
                            value={payRef}
                            onChangeText={setPayRef}
                            placeholder="Transaction / reference (optional)"
                            placeholderTextColor={colors.textMuted}
                          />
                          <View style={styles.btnRow}>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={() => setPayMode(null)} disabled={busy}>
                              <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success, flex: 2 }, busy && { opacity: 0.6 }]} onPress={savePayment} disabled={busy}>
                              {busy ? (
                                <ActivityIndicator color={colors.white} />
                              ) : (
                                <Text style={[typography.caption, styles.btnText]}>Save</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {!payMode && s.status === 'Refund Pending' && (
                        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.success }]} onPress={() => setPayMode('refund')}>
                          <Ionicons name="cash-outline" size={18} color={colors.white} />
                          <Text style={[typography.button, styles.bigBtnText]}>Mark Refund Paid</Text>
                        </TouchableOpacity>
                      )}
                      {!payMode && s.status === 'Amount Owed' && (
                        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.success }]} onPress={() => setPayMode('dues')}>
                          <Ionicons name="cash-outline" size={18} color={colors.white} />
                          <Text style={[typography.button, styles.bigBtnText]}>Mark Dues Received</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.bigBtn, { backgroundColor: colors.primary }, pdfBusy && { opacity: 0.6 }]}
                        onPress={downloadStatement}
                        disabled={pdfBusy}
                      >
                        {pdfBusy ? (
                          <ActivityIndicator color={colors.white} />
                        ) : (
                          <>
                            <Ionicons name="download-outline" size={18} color={colors.white} />
                            <Text style={[typography.button, styles.bigBtnText]}>Download Settlement Statement</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </ScrollView>
                  </>
                );
              })()}
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
  backButton: { padding: spacing.xs },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  summarySub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  label: { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  box: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  methodRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  methodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.white, fontWeight: '700' },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  bigBtnText: { color: colors.white, marginLeft: spacing.xs },
});