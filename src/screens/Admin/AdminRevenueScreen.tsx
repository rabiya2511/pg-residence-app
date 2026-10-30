import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isPreBookedNow } from '../../context/AdminContext';

const CHART_HEIGHT = 160;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_3 = MONTH_NAMES.map((m) => m.slice(0, 3));
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const prettyDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS_3[m - 1]} ${y}`;
};
const ymLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

// Understands "20 Oct 2026" (admin format) and "Oct 20, 2026" (seed format).
function parseAnyDate(str?: string | null): Date | null {
  if (!str) return null;
  const s = str.trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m![2].toLowerCase());
    return idx === -1 ? null : new Date(Number(m[3]), idx, Number(m[1]));
  }
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m![1].toLowerCase());
    return idx === -1 ? null : new Date(Number(m[3]), idx, Number(m[2]));
  }
  return null;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function methodIcon(method: string): any {
  const m = (method || '').toLowerCase();
  if (m.includes('upi')) return 'phone-portrait-outline';
  if (m.includes('cash')) return 'cash-outline';
  if (m.includes('card')) return 'card-outline';
  if (m.includes('bank')) return 'business-outline';
  return 'wallet-outline';
}

type Txn = {
  id: string;
  key: string; // yyyy-mm-dd
  amount: number;
  method: string;
  kind: 'Rent' | 'Day Guest';
  name: string;
  room: string;
  ref?: string;
  time?: string;
  at: number;
};

type Selection =
  | { kind: 'month'; ym: string }
  | { kind: 'day'; key: string }
  | { kind: 'range'; from: string; to: string };

export default function AdminRevenueScreen() {
  const navigation = useNavigation();
  const { residents, archivedResidents, paymentRecords, dailyGuests, rooms, clearRevenueData, restoreRevenueData, activeProperty } = useAdmin();
  const [exportingPdf, setExportingPdf] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const detailsY = useRef(0);

  /* ------------------------- every payment actually received ------------------------- */
  const txns = useMemo<Txn[]>(() => {
    const info = new Map<string, { name: string; roomId?: string }>();
    [...residents, ...archivedResidents].forEach((r) => info.set(r.id, { name: r.name, roomId: r.roomId }));
    const roomLabel = (roomId?: string) => {
      const r = rooms.find((x) => x.id === roomId);
      return r ? `Room ${r.roomNumber}` : '';
    };

    const out: Txn[] = [];

    paymentRecords.forEach((p) => {
      if (p.status !== 'Paid' || (p as any).revenueCleared) return;
      const d = parseAnyDate(p.paidOn);
      if (!d) return;
      const who = info.get(p.residentId);
      out.push({
        id: `r_${p.id}`,
        key: dateKey(d),
        amount: p.amount,
        method: p.method ?? 'Cash',
        kind: 'Rent',
        name: who?.name ?? 'Resident',
        room: roomLabel(who?.roomId),
        ref: p.transactionId,
        at: d.getTime(),
      });
    });

    dailyGuests.forEach((g: any) => {
      const listed: any[] = Array.isArray(g.payments) ? [...g.payments] : [];
      // Anything paid at check-in (before individual payments were tracked) shows up as the first payment.
      const listedTotal = listed.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const initial = (g.advanceAmount ?? 0) - listedTotal;
      if (initial > 0) {
        listed.unshift({ amount: initial, method: g.paymentMethod, at: g.checkInTimestamp });
      }
      const clearedAt = Number(g.revenueClearedAt) || 0;
      listed.forEach((pay, i) => {
        const at = Number(pay.at) || g.checkInTimestamp || Date.now();
        if (clearedAt > 0 && at <= clearedAt) return; // hidden by "Clear data"
        out.push({
          id: `g_${g.id}_${i}`,
          key: dateKey(new Date(at)),
          amount: Number(pay.amount) || 0,
          method: pay.method ?? g.paymentMethod ?? 'Cash',
          kind: 'Day Guest',
          name: g.name,
          room: roomLabel(g.roomId),
          time: formatTime(at),
          at,
        });
      });
    });

    return out.filter((t) => t.amount > 0);
  }, [residents, archivedResidents, paymentRecords, dailyGuests, rooms]);

  /* ------------------------- clear / restore ------------------------- */
  const handleClearData = () => {
    Alert.alert(
      'Revenue Data',
      'Clear removes every payment received so far from this Monthly Revenue screen.\n\nRent records, pending dues and guest records are NOT deleted, and you can restore the cleared data any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Cleared',
          onPress: async () => {
            const res = await restoreRevenueData();
            if (!res.ok) Alert.alert('Could Not Restore', res.message ?? 'Please try again.');
            else Alert.alert('Restored', res.count > 0 ? 'The cleared revenue data is back.' : 'Nothing was cleared.');
          },
        },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Clear All Revenue Data?', 'All payments received so far will be removed from this screen.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Clear',
                style: 'destructive',
                onPress: async () => {
                  const res = await clearRevenueData();
                  if (!res.ok) Alert.alert('Could Not Clear', res.message ?? 'Please try again.');
                  else Alert.alert('Cleared', res.count > 0 ? 'Revenue data has been cleared.' : 'There was nothing to clear.');
                },
              },
            ]),
        },
      ]
    );
  };

  /* ------------------------- last 6 months ------------------------- */
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const inMonth = txns.filter((t) => t.key.startsWith(ym));
      return {
        ym,
        label: MONTHS_3[d.getMonth()],
        year: d.getFullYear(),
        amount: inMonth.reduce((s, t) => s + t.amount, 0),
        count: inMonth.length,
      };
    });
  }, [txns]);

  const currentYm = months[months.length - 1].ym;
  const [sel, setSel] = useState<Selection>({ kind: 'month', ym: currentYm });
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [anchor, setAnchor] = useState<string | null>(null);

  const maxAmount = Math.max(1, ...months.map((m) => m.amount));
  const totalRevenue = months.reduce((s, m) => s + m.amount, 0);
  const avgRevenue = Math.round(totalRevenue / months.length);

  const scrollToDetails = () =>
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, detailsY.current - 8), animated: true }), 60);

  const pickMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    setSel({ kind: 'month', ym });
    setCalMonth(new Date(y, m - 1, 1));
    setAnchor(null);
    scrollToDetails();
  };

  const pickDay = (key: string) => {
    if (mode === 'range' && anchor) {
      const from = key < anchor ? key : anchor;
      const to = key < anchor ? anchor : key;
      setSel({ kind: 'range', from, to });
      setAnchor(null);
      scrollToDetails();
      return;
    }
    setSel({ kind: 'day', key });
    setAnchor(mode === 'range' ? key : null);
    if (mode === 'day') scrollToDetails();
  };

  const goToday = () => {
    const n = new Date();
    setMode('day');
    setAnchor(null);
    setCalMonth(new Date(n.getFullYear(), n.getMonth(), 1));
    setSel({ kind: 'day', key: dateKey(n) });
    scrollToDetails();
  };

  /* ------------------------- what is selected ------------------------- */
  const selectedTxns = useMemo(() => {
    const list = txns.filter((t) =>
      sel.kind === 'month'
        ? t.key.startsWith(sel.ym)
        : sel.kind === 'day'
        ? t.key === sel.key
        : t.key >= sel.from && t.key <= sel.to
    );
    return list.sort((a, b) => (a.key === b.key ? b.at - a.at : a.key < b.key ? 1 : -1));
  }, [txns, sel]);

  const selTotal = selectedTxns.reduce((s, t) => s + t.amount, 0);
  const selRent = selectedTxns.filter((t) => t.kind === 'Rent').reduce((s, t) => s + t.amount, 0);
  const selGuest = selTotal - selRent;
  const byMethod = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    selectedTxns.forEach((t) => {
      const cur = map.get(t.method) ?? { amount: 0, count: 0 };
      map.set(t.method, { amount: cur.amount + t.amount, count: cur.count + 1 });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [selectedTxns]);

  const periodTitle =
    sel.kind === 'month'
      ? ymLabel(sel.ym)
      : sel.kind === 'day'
      ? prettyDate(sel.key)
      : `${prettyDate(sel.from)} – ${prettyDate(sel.to)}`;
  const showSpan = sel.kind === 'range' || sel.kind === 'month';

  // Change vs the month before (only meaningful when a whole month is selected).
  let change: number | null = null;
  if (sel.kind === 'month') {
    const idx = months.findIndex((m) => m.ym === sel.ym);
    const prev = idx > 0 ? months[idx - 1] : null;
    if (prev && prev.amount > 0) change = Math.round(((selTotal - prev.amount) / prev.amount) * 100);
  }

  /* ------------------------- collection status (rent) for the month in focus ------------------------- */
  const focusYm = sel.kind === 'month' ? sel.ym : sel.kind === 'day' ? sel.key.slice(0, 7) : sel.from.slice(0, 7);
  // Dues are counted for CURRENT residents only. Payments already received stay in the totals,
  // but unpaid rent of vacated, archived or deleted residents is not a due any more.
  const currentResidentIds = new Set(residents.filter((r) => !isPreBookedNow(r)).map((r) => r.id));
  const focusRecords = paymentRecords.filter(
    (p) =>
      p.month === ymLabel(focusYm) &&
      !(p.status === 'Paid' && (p as any).revenueCleared) &&
      (p.status === 'Paid' || currentResidentIds.has(p.residentId))
  );
  const overallAmount = focusRecords.reduce((s, p) => s + p.amount, 0);
  const collectedAmount = focusRecords.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const dueAmount = overallAmount - collectedAmount;
  const collectedPercent = overallAmount > 0 ? Math.round((collectedAmount / overallAmount) * 100) : 0;
  const unpaidRecords = focusRecords.filter((p) => p.status !== 'Paid');
  const nameOf = (residentId: string) =>
    [...residents, ...archivedResidents].find((r) => r.id === residentId)?.name ?? 'Resident';
  const roomOf = (residentId: string) => {
    const r = [...residents, ...archivedResidents].find((x) => x.id === residentId);
    const room = rooms.find((x) => x.id === r?.roomId);
    return room ? `Room ${room.roomNumber}` : '';
  };

  /* ------------------------- PDF report ------------------------- */
  const esc = (v: any) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const buildReportHtml = () => {
    const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const pgName = activeProperty?.name ?? 'My PG';
    const txnRows = selectedTxns
      .map(
        (t, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(prettyDate(t.key))}</td>
          <td>${esc(t.name)}</td>
          <td>${esc(t.room)}</td>
          <td>${esc(t.kind)}</td>
          <td>${esc(t.method)}</td>
          <td class="r">${esc(formatINR(t.amount))}</td>
        </tr>`
      )
      .join('');
    const methodRows = byMethod
      .map(([m, v]) => `<tr><td>${esc(m)}</td><td class="r">${v.count}</td><td class="r">${esc(formatINR(v.amount))}</td></tr>`)
      .join('');
    const monthRows = months
      .map((m) => `<tr><td>${esc(m.label)} ${m.year}</td><td class="r">${m.count}</td><td class="r">${esc(formatINR(m.amount))}</td></tr>`)
      .join('');
    const unpaidRows = unpaidRecords
      .map(
        (p, i) => `<tr><td>${i + 1}</td><td>${esc(nameOf(p.residentId))}</td><td>${esc(roomOf(p.residentId))}</td>
          <td>${esc(p.status)}</td><td class="r">${esc(formatINR(p.amount))}</td></tr>`
      )
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: Helvetica, Arial, sans-serif; color: #111827; padding: 24px; font-size: 12px; }
      h1 { font-size: 22px; margin: 0 0 2px 0; }
      h2 { font-size: 15px; margin: 22px 0 8px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
      .muted { color: #6b7280; }
      .kpis { display: flex; gap: 10px; margin-top: 12px; }
      .kpi { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
      .kpi .v { font-size: 17px; font-weight: 700; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; background: #f3f4f6; padding: 7px 6px; font-size: 11px; }
      td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
      .r { text-align: right; }
      tr { page-break-inside: avoid; }
    </style></head><body>
      <h1>Monthly Revenue Report</h1>
      <div class="muted">${esc(pgName)} &middot; ${esc(periodTitle)}</div>
      <div class="muted">Generated on ${esc(generated)}</div>

      <div class="kpis">
        <div class="kpi"><div class="muted">Total received</div><div class="v">${esc(formatINR(selTotal))}</div></div>
        <div class="kpi"><div class="muted">Rent</div><div class="v">${esc(formatINR(selRent))}</div></div>
        <div class="kpi"><div class="muted">Day guests</div><div class="v">${esc(formatINR(selGuest))}</div></div>
        <div class="kpi"><div class="muted">Payments</div><div class="v">${selectedTxns.length}</div></div>
      </div>

      <h2>Rent collection status &middot; ${esc(ymLabel(focusYm))}</h2>
      <table>
        <tr><th>Expected</th><th>Collected</th><th>Due</th><th>Collected %</th></tr>
        <tr><td>${esc(formatINR(overallAmount))}</td><td>${esc(formatINR(collectedAmount))}</td><td>${esc(formatINR(dueAmount))}</td><td>${collectedPercent}%</td></tr>
      </table>

      <h2>Last 6 months</h2>
      <table>
        <tr><th>Month</th><th class="r">Payments</th><th class="r">Revenue</th></tr>
        ${monthRows}
        <tr><td><b>Total</b></td><td></td><td class="r"><b>${esc(formatINR(totalRevenue))}</b></td></tr>
      </table>

      <h2>By payment mode</h2>
      ${
        byMethod.length
          ? `<table><tr><th>Mode</th><th class="r">Payments</th><th class="r">Amount</th></tr>${methodRows}</table>`
          : '<div class="muted">No payments in this period.</div>'
      }

      <h2>Payments received</h2>
      ${
        selectedTxns.length
          ? `<table><tr><th>#</th><th>Date</th><th>Name</th><th>Room</th><th>Type</th><th>Mode</th><th class="r">Amount</th></tr>${txnRows}
             <tr><td colspan="6"><b>Total</b></td><td class="r"><b>${esc(formatINR(selTotal))}</b></td></tr></table>`
          : '<div class="muted">No payments were received in this period.</div>'
      }

      ${
        unpaidRecords.length
          ? `<h2>Unpaid rent &middot; ${esc(ymLabel(focusYm))}</h2>
             <table><tr><th>#</th><th>Resident</th><th>Room</th><th>Status</th><th class="r">Amount</th></tr>${unpaidRows}</table>`
          : ''
      }
    </body></html>`;
  };

  const handleDownloadPdf = async () => {
    try {
      setExportingPdf(true);
      const { uri } = await Print.printToFileAsync({ html: buildReportHtml(), base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Revenue Report - ${periodTitle}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Generated', `Saved to: ${uri}`);
      }
    } catch (e: any) {
      console.warn('revenue pdf failed:', e?.message ?? e);
      Alert.alert('Export Failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  /* ------------------------- calendar ------------------------- */
  const marks = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    txns.forEach((t) => {
      const cur = map.get(t.key) ?? { count: 0, total: 0 };
      map.set(t.key, { count: cur.count + 1, total: cur.total + t.amount });
    });
    return map;
  }, [txns]);

  const calYear = calMonth.getFullYear();
  const calM = calMonth.getMonth();
  const firstDow = new Date(calYear, calM, 1).getDay();
  const daysInMonth = new Date(calYear, calM + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayKey = dateKey(new Date());

  const isSelectedDay = (key: string) =>
    (sel.kind === 'day' && sel.key === key) ||
    (sel.kind === 'range' && (sel.from === key || sel.to === key)) ||
    anchor === key;
  const inRange = (key: string) => sel.kind === 'range' && key > sel.from && key < sel.to;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Monthly Revenue</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleDownloadPdf}
            disabled={exportingPdf}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearData}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ---------------- Summary of the selected period ---------------- */}
        <View style={styles.summaryCard}>
          <Text style={[typography.caption, { color: 'rgba(255,255,255,0.75)' }]}>
            {sel.kind === 'day' ? 'Received on' : 'Revenue'} · {periodTitle}
          </Text>
          <Text style={[typography.heading1, { color: colors.white, marginTop: 4 }]}>{formatINR(selTotal)}</Text>
          {change !== null ? (
            <View style={styles.changeRow}>
              <Ionicons name={change >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color={colors.white} />
              <Text style={[typography.caption, { color: colors.white, marginLeft: 4 }]}>
                {Math.abs(change)}% vs last month
              </Text>
            </View>
          ) : (
            <Text style={[typography.caption, { color: 'rgba(255,255,255,0.75)', marginTop: spacing.sm }]}>
              {selectedTxns.length} payment{selectedTxns.length !== 1 ? 's' : ''}
              {showSpan ? ` · Rent ${formatINR(selRent)} · Day guests ${formatINR(selGuest)}` : ''}
            </Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Total (6 mo)</Text>
            <Text style={[typography.heading3, { color: colors.text }]}>{formatINR(totalRevenue)}</Text>
          </View>
          <View style={[styles.statBox, { marginRight: 0 }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Average</Text>
            <Text style={[typography.heading3, { color: colors.text }]}>{formatINR(avgRevenue)}</Text>
          </View>
        </View>

        {/* ---------------- Calendar ---------------- */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>
          Pick a Date
        </Text>
        <View style={styles.card}>
          <View style={styles.modeRow}>
            {(['day', 'range'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeChip, mode === m && styles.modeChipActive]}
                onPress={() => {
                  setMode(m);
                  setAnchor(null);
                }}
              >
                <Text style={[typography.caption, { color: mode === m ? colors.white : colors.text, fontWeight: '700' }]}>
                  {m === 'day' ? 'Single day' : 'Date range'}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={goToday} style={styles.linkBtn}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Today</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() => setCalMonth(new Date(calYear, calM - 1, 1))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              {MONTH_NAMES[calM]} {calYear}
            </Text>
            <TouchableOpacity
              onPress={() => setCalMonth(new Date(calYear, calM + 1, 1))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={[styles.weekDay, typography.caption]}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={i} style={styles.cell} />;
              const key = `${calYear}-${pad(calM + 1)}-${pad(day)}`;
              const selected = isSelectedDay(key);
              const mark = marks.get(key);
              return (
                <TouchableOpacity key={i} style={styles.cell} activeOpacity={0.7} onPress={() => pickDay(key)}>
                  <View
                    style={[
                      styles.dayBubble,
                      inRange(key) && styles.dayInRange,
                      key === todayKey && !selected && styles.dayToday,
                      selected && styles.daySelected,
                    ]}
                  >
                    <Text style={[typography.caption, { color: selected ? colors.white : colors.text, fontWeight: selected ? '800' : '500' }]}>
                      {day}
                    </Text>
                  </View>
                  <View style={[styles.dot, { backgroundColor: mark ? colors.success : 'transparent' }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {mode === 'range'
              ? anchor
                ? `Start: ${prettyDate(anchor)} — now tap the end date`
                : 'Tap a start date, then an end date'
              : 'Green dot = payments received that day'}
          </Text>
        </View>

        {/* ---------------- Details of the selection ---------------- */}
        <View onLayout={(e) => (detailsY.current = e.nativeEvent.layout.y)}>
          <View style={styles.detailsHeader}>
            <Text style={[typography.heading3, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              Payments · {periodTitle}
            </Text>
            {sel.kind !== 'month' && (
              <TouchableOpacity onPress={() => pickMonth(currentYm)} style={styles.linkBtn}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>This month</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.totalRow}>
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Total received</Text>
                <Text style={[typography.heading2, { color: colors.success }]}>{formatINR(selTotal)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Rent {formatINR(selRent)}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Day guests {formatINR(selGuest)}</Text>
              </View>
            </View>

            {byMethod.length > 0 && (
              <View style={styles.methodRow}>
                {byMethod.map(([method, v]) => (
                  <View key={method} style={styles.methodChip}>
                    <Ionicons name={methodIcon(method)} size={14} color={colors.primary} />
                    <Text style={[typography.caption, { color: colors.text, marginLeft: 4, fontWeight: '600' }]}>
                      {method} · {formatINR(v.amount)} ({v.count})
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {selectedTxns.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
                  No payments were received {sel.kind === 'day' ? 'on this day' : 'in this period'}.
                </Text>
              </View>
            ) : (
              selectedTxns.map((t) => (
                <View key={t.id} style={styles.txnRow}>
                  <View style={styles.txnIcon}>
                    <Ionicons name={methodIcon(t.method)} size={18} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{t.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {[t.room, t.kind, t.method].filter(Boolean).join(' · ')}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {prettyDate(t.key)}
                      {t.time ? ` · ${t.time}` : ''}
                      {t.ref ? ` · Ref ${t.ref}` : ''}
                    </Text>
                  </View>
                  <Text style={[typography.bodyBold, { color: colors.success }]}>+{formatINR(t.amount)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ---------------- Collection status (rent) ---------------- */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>
          Collection Status · {ymLabel(focusYm)}
        </Text>

        <View style={styles.card}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${collectedPercent}%` }]} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {overallAmount > 0 ? `${collectedPercent}% of rent collected` : 'No rent records for this month'}
          </Text>

          <View style={styles.collectionRow}>
            <View style={styles.collectionItem}>
              <View style={[styles.collectionDot, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Overall</Text>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{formatINR(overallAmount)}</Text>
              </View>
            </View>
            <View style={styles.collectionItem}>
              <View style={[styles.collectionDot, { backgroundColor: colors.success }]} />
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Collected</Text>
                <Text style={[typography.bodyBold, { color: colors.success }]}>{formatINR(collectedAmount)}</Text>
              </View>
            </View>
            <View style={styles.collectionItem}>
              <View style={[styles.collectionDot, { backgroundColor: colors.error }]} />
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Dues</Text>
                <Text style={[typography.bodyBold, { color: colors.error }]}>{formatINR(dueAmount)}</Text>
              </View>
            </View>
          </View>

          {unpaidRecords.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                Still pending ({unpaidRecords.length})
              </Text>
              {unpaidRecords.map((p) => (
                <View key={p.id} style={styles.dueRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{nameOf(p.residentId)}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {[roomOf(p.residentId), `Due ${p.dueDate}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[typography.bodyBold, { color: colors.error }]}>{formatINR(p.amount)}</Text>
                    <Text style={[typography.caption, { color: p.status === 'Overdue' ? colors.error : colors.warning, fontWeight: '700' }]}>
                      {p.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ---------------- Trend (tap a bar) ---------------- */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>
          Trend
        </Text>

        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {months.map((entry) => {
              const barHeight = Math.max(4, (entry.amount / maxAmount) * CHART_HEIGHT);
              const isSelected = sel.kind === 'month' ? sel.ym === entry.ym : focusYm === entry.ym;
              return (
                <TouchableOpacity
                  key={entry.ym}
                  style={styles.barColumn}
                  activeOpacity={0.8}
                  onPress={() => pickMonth(entry.ym)}
                >
                  <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>
                    {entry.amount >= 1000 ? `${(entry.amount / 1000).toFixed(entry.amount >= 10000 ? 0 : 1)}k` : entry.amount}
                  </Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: isSelected ? colors.primary : colors.primaryLight,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      typography.caption,
                      { color: isSelected ? colors.primary : colors.textMuted, marginTop: 6, fontWeight: isSelected ? '800' : '400' },
                    ]}
                  >
                    {entry.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            Tap a bar to see that month's payments
          </Text>
        </View>

        {/* ---------------- Monthly breakdown (tap a month) ---------------- */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Monthly Breakdown <Text style={[typography.caption, { color: colors.textMuted }]}>(last 3 months)</Text>
        </Text>
        {[...months].reverse().slice(0, 3).map((entry) => {
          const isSelected = sel.kind === 'month' && sel.ym === entry.ym;
          return (
            <TouchableOpacity
              key={entry.ym}
              style={[styles.listRow, isSelected && styles.listRowActive]}
              activeOpacity={0.8}
              onPress={() => pickMonth(entry.ym)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text }]}>
                  {MONTHS_3[Number(entry.ym.slice(5)) - 1]} {entry.year}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {entry.count} payment{entry.count !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{formatINR(entry.amount)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
            </TouchableOpacity>
          );
        })}
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
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  summaryCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg },
  changeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', marginTop: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  modeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  linkBtn: { paddingHorizontal: spacing.xs, paddingVertical: 4 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.xs },
  weekRow: { flexDirection: 'row', marginTop: spacing.xs },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', color: colors.textMuted, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, height: 46 },
  dayBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayInRange: { backgroundColor: colors.primaryLight, borderRadius: 8 },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  detailsHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.lg },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${colors.success}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressBarTrack: { height: 8, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: radius.full, backgroundColor: colors.success },
  collectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  collectionItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  collectionDot: { width: 8, height: 8, borderRadius: radius.full, marginRight: spacing.xs },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 40,
  },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 24, borderRadius: radius.sm },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listRowActive: { borderColor: colors.primary, borderWidth: 2 },
});