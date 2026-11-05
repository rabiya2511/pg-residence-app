import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRent } from '../../context/RentContext';
import { useResident } from '../../context/ResidentContext';

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "October 2026" -> { m: 9, y: 2026 }
const parseMonth = (label: string) => {
  const [name, year] = (label || '').split(' ');
  return { m: MONTH_FULL.findIndex((x) => x === name), y: Number(year) || 0 };
};

const receiptNo = (txn?: string, id?: string) =>
  `RC-${((txn || id || '').replace(/[^0-9A-Za-z]/g, '').slice(-8) || '00000000').toUpperCase()}`;

const esc = (v: any) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);

// Rent Details = where the resident SEES their rent: this month's status, dues and history.
// Paying happens on the separate Pay Rent screen (opened with the Pay Now button).
export default function RentDetailsScreen() {
  const navigation = useNavigation<any>();
  const { rentStatus, paymentHistory } = useRent();
  const { residentData } = useResident();

  const [query, setQuery] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { status, isPaid, amount, grossAmount, deduction, deductionReason, pendingVerification, rejectedPayment } = rentStatus;
  const statusColor =
    status === 'Paid'
      ? colors.success
      : status === 'Overdue'
      ? colors.error
      : status === 'Under Verification'
      ? colors.warning
      : colors.primary;

  const dueText = isPaid
    ? 'Paid for this month'
    : pendingVerification
    ? 'Waiting for the admin to confirm your payment'
    : rentStatus.dueInDays < 0
    ? `Overdue by ${Math.abs(rentStatus.dueInDays)} day${Math.abs(rentStatus.dueInDays) === 1 ? '' : 's'}`
    : rentStatus.dueInDays === 0
    ? 'Due today'
    : `Due in ${rentStatus.dueInDays} day${rentStatus.dueInDays === 1 ? '' : 's'}`;

  const dueDateText = rentStatus.dueDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const sorted = useMemo(
    () => [...paymentHistory].sort((a, b) => (Date.parse(b.paidOn) || 0) - (Date.parse(a.paidOn) || 0)),
    [paymentHistory]
  );

  const years = useMemo(
    () => Array.from(new Set(sorted.map((p) => parseMonth(p.month).y).filter(Boolean))).sort((a, b) => b - a),
    [sorted]
  );

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((p) => {
      const pm = parseMonth(p.month);
      if (year !== null && pm.y !== year) return false;
      if (month !== null && pm.m !== month) return false;
      if (!q) return true;
      return [p.month, p.paidOn, p.method, p.transactionId, String(p.amount)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [sorted, query, year, month]);

  const filtering = query.trim() !== '' || year !== null || month !== null;

  const downloadReceipt = async (p: (typeof sorted)[number]) => {
    try {
      setBusyId(p.id);
      const html = `
        <html><body style="font-family: Arial, sans-serif; padding: 28px; color: #111;">
          <h2 style="margin:0">Rent Receipt</h2>
          <p style="margin:4px 0 18px; color:#555;">${esc(residentData.pgName || 'PG')}</p>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr><td style="padding:8px 0; color:#555;">Receipt No.</td><td style="text-align:right;"><b>${esc(receiptNo(p.transactionId, p.id))}</b></td></tr>
            <tr><td style="padding:8px 0; color:#555;">Resident</td><td style="text-align:right;">${esc(residentData.name)}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">Room</td><td style="text-align:right;">${esc(residentData.room || '—')}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">Rent for</td><td style="text-align:right;">${esc(p.month)}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">Paid on</td><td style="text-align:right;">${esc(p.paidOn || '—')}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">Payment method</td><td style="text-align:right;">${esc(p.method || '—')}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">Transaction ID</td><td style="text-align:right;">${esc(p.transactionId || '—')}</td></tr>
            <tr><td style="padding:8px 0; color:#555;">Status</td><td style="text-align:right;">Paid</td></tr>
            <tr style="border-top:2px solid #111;"><td style="padding:12px 0; font-size:16px;"><b>Amount paid</b></td><td style="text-align:right; font-size:16px;"><b>${esc(inr(p.amount))}</b></td></tr>
          </table>
          <p style="margin-top:28px; color:#777; font-size:12px;">This is a computer-generated receipt.</p>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Rent receipt' });
      } else {
        Alert.alert('Receipt Saved', 'The receipt was created, but sharing is not available on this device.');
      }
    } catch (e: any) {
      console.warn('receipt failed:', e?.message ?? e);
      Alert.alert('Receipt Failed', 'Could not create the receipt. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Rent Details</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* This month */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>{rentStatus.monthLabel}</Text>
            <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[typography.caption, { color: statusColor, fontWeight: '700' }]}>{status}</Text>
            </View>
          </View>

          <Text style={[typography.heading1, { color: colors.text, marginTop: spacing.sm }]}>{inr(amount)}</Text>
          <Text style={[typography.caption, { color: status === 'Overdue' ? colors.error : colors.textMuted, marginTop: 2 }]}>
            {dueText} · Due date {dueDateText}
          </Text>

          {!!pendingVerification && (
            <View style={[styles.deductionBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[typography.caption, { color: colors.text }]}>
                UPI reference {pendingVerification.upiRef} sent for verification.
              </Text>
            </View>
          )}
          {!!rejectedPayment && (
            <View style={[styles.deductionBox, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>
                Your last payment (ref {rejectedPayment.upiRef}) was rejected
              </Text>
              {!!rejectedPayment.reviewNote && (
                <Text style={[typography.caption, { color: colors.text, marginTop: 2 }]}>{rejectedPayment.reviewNote}</Text>
              )}
            </View>
          )}

          {deduction > 0 && (
            <View style={styles.deductionBox}>
              <View style={styles.rowBetween}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Monthly rent</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{inr(grossAmount)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Deduction</Text>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>−{inr(deduction)}</Text>
              </View>
              {!!deductionReason && (
                <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic', marginTop: 2 }]}>
                  {deductionReason}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Outstanding */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Total outstanding</Text>
            <Text
              style={[
                typography.bodyBold,
                { color: rentStatus.totalOutstanding > 0 ? colors.error : colors.success },
              ]}
            >
              {inr(rentStatus.totalOutstanding)}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
            {rentStatus.unpaidMonths > 0
              ? `${rentStatus.unpaidMonths} unpaid month${rentStatus.unpaidMonths === 1 ? '' : 's'}`
              : 'No pending dues'}
          </Text>
          {rentStatus.lastPayment && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
              Last payment: {inr(rentStatus.lastPayment.amount)} on {rentStatus.lastPayment.paidOn || '—'}
            </Text>
          )}
        </View>

        {/* History */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Payment History
        </Text>

        {sorted.length > 0 && (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search month, method, transaction ID"
                placeholderTextColor={colors.textMuted}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, year === null && styles.chipOn]}
                onPress={() => setYear(null)}
              >
                <Text style={[styles.chipText, year === null && { color: colors.white }]}>All years</Text>
              </TouchableOpacity>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.chip, year === y && styles.chipOn]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.chipText, year === y && { color: colors.white }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, month === null && styles.chipOn]}
                onPress={() => setMonth(null)}
              >
                <Text style={[styles.chipText, month === null && { color: colors.white }]}>All months</Text>
              </TouchableOpacity>
              {MONTHS.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, month === idx && styles.chipOn]}
                  onPress={() => setMonth(idx)}
                >
                  <Text style={[styles.chipText, month === idx && { color: colors.white }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={26} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>No payments yet.</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={26} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
              No payments match your search.
            </Text>
          </View>
        ) : (
          history.map((p) => {
            const open = openId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.historyRow}
                activeOpacity={0.85}
                onPress={() => setOpenId(open ? null : p.id)}
              >
                <View style={styles.historyTop}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="checkmark" size={18} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{p.month}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {p.paidOn || '—'}
                      {p.method ? ` · ${p.method}` : ''}
                    </Text>
                  </View>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{inr(p.amount)}</Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                    style={{ marginLeft: 6 }}
                  />
                </View>

                {open && (
                  <View style={styles.details}>
                    <View style={styles.rowBetween}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Receipt No.</Text>
                      <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>
                        {receiptNo(p.transactionId, p.id)}
                      </Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction ID</Text>
                      <Text style={[typography.caption, { color: colors.text }]} selectable>
                        {p.transactionId || '—'}
                      </Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Method</Text>
                      <Text style={[typography.caption, { color: colors.text }]}>{p.method || '—'}</Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Status</Text>
                      <Text style={[typography.caption, { color: colors.success, fontWeight: '700' }]}>Paid</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.receiptBtn}
                      activeOpacity={0.85}
                      disabled={busyId === p.id}
                      onPress={() => downloadReceipt(p)}
                    >
                      {busyId === p.id ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={16} color={colors.white} />
                          <Text style={styles.receiptText}>Download Receipt (PDF)</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        {filtering && history.length > 0 && (
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
            Showing {history.length} of {sorted.length} payments
          </Text>
        )}
      </ScrollView>

      {/* Pay Now only while this month's rent is unpaid */}
      {!isPaid && !pendingVerification && amount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.payButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PayRent')}
          >
            <Text style={[typography.button, { color: colors.white }]}>
              {rejectedPayment ? 'Pay Again' : 'Pay Now'} · {inr(amount)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  deductionBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.lg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, marginLeft: spacing.sm },
  chipScroll: { marginBottom: spacing.sm, flexGrow: 0 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.xs,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  historyTop: { flexDirection: 'row', alignItems: 'center' },
  details: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  receiptText: { color: colors.white, fontWeight: '700', marginLeft: 6, fontSize: 13 },
  historyRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.success}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { padding: spacing.md },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});