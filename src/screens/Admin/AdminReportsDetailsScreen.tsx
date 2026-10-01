import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';

type DateRangeKey = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Last Month' | 'This Year' | 'All Records';

const DATE_RANGE_OPTIONS: DateRangeKey[] = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'This Year', 'All Records'];

const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parses "25 Sep 2026" (dd MMM yyyy)
function parseDisplayDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return null;
  return new Date(Number(m[3]), monthIdx, Number(m[1]));
}

// Parses "Aug 3, 2026" (seed payment format) or "03 Aug 2026" (admin format)
function parsePaidOnDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const m = str.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[1].toLowerCase());
    if (monthIdx === -1) return null;
    return new Date(Number(m[3]), monthIdx, Number(m[2]));
  }
  return parseDisplayDate(str);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const formatShort = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function getDateRangeBounds(key: DateRangeKey): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  switch (key) {
    case 'Today':
      return { start: startOfDay(now), end: endOfDay(now), label: formatShort(now) };
    case 'Yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y), label: formatShort(y) };
    }
    case 'This Week': {
      const diffToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - diffToMonday);
      return { start: startOfDay(monday), end: endOfDay(now), label: `${formatShort(monday)} - ${formatShort(now)}` };
    }
    case 'This Month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: `${formatShort(start)} - ${formatShort(end)}` };
    }
    case 'Last Month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end, label: `${formatShort(start)} - ${formatShort(end)}` };
    }
    case 'This Year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: endOfDay(now), label: `${formatShort(start)} - ${formatShort(now)}` };
    }
    case 'All Records':
    default:
      return { start: null, end: null, label: 'All time' };
  }
}

function inRange(date: Date | null, start: Date | null, end: Date | null): boolean {
  if (!date) return false;
  if (!start || !end) return true; // All Records
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

type Kpi = { label: string; value: string; color?: string };
type Row = { primary: string; secondary: string; tertiary?: string; badge?: { label: string; color: string } };

export default function AdminReportDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { reportId, title } = route.params as { reportId: string; title?: string };
  const { residents, rooms, properties, dailyGuests, paymentRecords, complaints } = useAdmin();

  const [dateRange, setDateRange] = useState<DateRangeKey>('This Month');
  const [exporting, setExporting] = useState(false);

  const reportTitle = title ?? 'Report';
  const { start, end, label: rangeLabel } = getDateRangeBounds(dateRange);

  const getRoomLabel = (roomId: string): string => {
    const room = rooms.find((r) => r.id === roomId);
    return room ? `${room.roomNumber} (${room.capacity} Sharing)` : 'Unassigned';
  };
  const getPropertyName = (propertyId: string): string => properties.find((p) => p.id === propertyId)?.name ?? '—';

  const report = useMemo(() => {
    const kpis: Kpi[] = [];
    const rows: Row[] = [];
    let columns: string[] = [];
    let pdfRows: string[][] = [];

    switch (reportId) {
      case 'resident-master': {
        const list = dateRange === 'All Records' ? residents : residents.filter((r) => inRange(parseDisplayDate(r.joiningDate), start, end));
        const activeCount = list.filter((r) => {
          const vd = parseDisplayDate(r.vacatingDate);
          return !vd || vd.getTime() >= Date.now();
        }).length;
        const totalRent = list.reduce((s, r) => s + r.monthlyRent, 0);
        const outstanding = list.filter((r) => r.rentStatus !== 'Paid').reduce((s, r) => s + r.monthlyRent, 0);

        kpis.push(
          { label: 'Total Residents', value: String(list.length) },
          { label: 'Active Residents', value: String(activeCount), color: colors.success },
          { label: 'Total Monthly Rent', value: `₹${totalRent.toLocaleString()}` },
          { label: 'Total Outstanding', value: `₹${outstanding.toLocaleString()}`, color: colors.error }
        );
        list.forEach((r) => {
          rows.push({
            primary: r.name,
            secondary: `${getRoomLabel(r.roomId)} · ${getPropertyName(r.propertyId)}`,
            tertiary: `${r.phone} · Joined ${r.joiningDate}`,
            badge: { label: r.rentStatus, color: r.rentStatus === 'Paid' ? colors.success : r.rentStatus === 'Pending' ? colors.warning : colors.error },
          });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Joining Date', 'Monthly Rent', 'Rent Status'];
        pdfRows = list.map((r) => [r.name, r.phone, getRoomLabel(r.roomId), getPropertyName(r.propertyId), r.joiningDate, `₹${r.monthlyRent}`, r.rentStatus]);
        break;
      }

      case 'active-residents': {
        const list = residents.filter((r) => {
          const vd = parseDisplayDate(r.vacatingDate);
          return !vd || vd.getTime() >= Date.now();
        });
        kpis.push(
          { label: 'Active Residents', value: String(list.length) },
          { label: 'Total Monthly Rent', value: `₹${list.reduce((s, r) => s + r.monthlyRent, 0).toLocaleString()}` }
        );
        list.forEach((r) => {
          rows.push({
            primary: r.name,
            secondary: `${getRoomLabel(r.roomId)} · ${getPropertyName(r.propertyId)}`,
            tertiary: r.phone,
            badge: { label: r.rentStatus, color: r.rentStatus === 'Paid' ? colors.success : colors.warning },
          });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Rent Status'];
        pdfRows = list.map((r) => [r.name, r.phone, getRoomLabel(r.roomId), getPropertyName(r.propertyId), r.rentStatus]);
        break;
      }

      case 'new-residents': {
        const list = residents.filter((r) => inRange(parseDisplayDate(r.joiningDate), start, end));
        kpis.push({ label: 'New Residents', value: String(list.length) }, { label: 'Window', value: rangeLabel });
        list.forEach((r) => {
          rows.push({ primary: r.name, secondary: `${getRoomLabel(r.roomId)} · ${getPropertyName(r.propertyId)}`, tertiary: `Joined ${r.joiningDate}` });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Joining Date'];
        pdfRows = list.map((r) => [r.name, r.phone, getRoomLabel(r.roomId), getPropertyName(r.propertyId), r.joiningDate]);
        break;
      }

      case 'checked-out-residents': {
        const list = residents.filter((r) => {
          const vd = parseDisplayDate(r.vacatingDate);
          return vd && vd.getTime() < Date.now() && (dateRange === 'All Records' || inRange(vd, start, end));
        });
        kpis.push({ label: 'Checked-Out Residents', value: String(list.length) });
        list.forEach((r) => {
          rows.push({ primary: r.name, secondary: `${getRoomLabel(r.roomId)} · ${getPropertyName(r.propertyId)}`, tertiary: `Vacated ${r.vacatingDate}` });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Vacated On'];
        pdfRows = list.map((r) => [r.name, r.phone, getRoomLabel(r.roomId), getPropertyName(r.propertyId), r.vacatingDate ?? '—']);
        break;
      }

      case 'notice-period-residents': {
        const list = residents.filter((r) => {
          const vd = parseDisplayDate(r.vacatingDate);
          return vd && vd.getTime() >= Date.now();
        });
        kpis.push(
          { label: 'On Notice', value: String(list.length) },
          { label: 'Emergency Notices', value: String(list.filter((r) => r.emergencyVacateDeductionPercent != null).length), color: colors.error }
        );
        list.forEach((r) => {
          rows.push({
            primary: r.name,
            secondary: `${getRoomLabel(r.roomId)} · ${getPropertyName(r.propertyId)}`,
            tertiary: `Vacating ${r.vacatingDate}`,
            badge: r.emergencyVacateDeductionPercent != null ? { label: 'Emergency', color: colors.error } : undefined,
          });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Vacating On', 'Reason'];
        pdfRows = list.map((r) => [r.name, r.phone, getRoomLabel(r.roomId), getPropertyName(r.propertyId), r.vacatingDate ?? '—', r.vacateReason ?? '—']);
        break;
      }

      case 'pre-bookings': {
        const upcoming = dailyGuests.filter((g) => g.checkInTimestamp > Date.now());
        kpis.push({ label: 'Upcoming Bookings', value: String(upcoming.length) });
        upcoming.forEach((g) => {
          rows.push({ primary: g.name, secondary: `${getRoomLabel(g.roomId)} · ${getPropertyName(g.propertyId)}`, tertiary: `Checking in ${g.checkInDate} · ${g.numDays} day(s)` });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Check-In', 'Days', 'Amount'];
        pdfRows = upcoming.map((g) => [g.name, g.phone, getRoomLabel(g.roomId), getPropertyName(g.propertyId), g.checkInDate, String(g.numDays), `₹${g.totalAmount}`]);
        break;
      }

      case 'daily-short-stay': {
        const list = dateRange === 'All Records' ? dailyGuests : dailyGuests.filter((g) => inRange(new Date(g.checkInTimestamp), start, end));
        kpis.push(
          { label: 'Day Guests', value: String(list.length) },
          { label: 'Currently Active', value: String(list.filter(isDailyGuestActiveNow).length), color: colors.success },
          { label: 'Total Revenue', value: `₹${list.reduce((s, g) => s + g.totalAmount, 0).toLocaleString()}` }
        );
        list.forEach((g) => {
          rows.push({
            primary: g.name,
            secondary: `${getRoomLabel(g.roomId)} · ${getPropertyName(g.propertyId)}`,
            tertiary: `${g.checkInDate} · ${g.numDays} day(s) · ₹${g.totalAmount}`,
            badge: { label: g.paymentStatus, color: g.paymentStatus === 'Paid' ? colors.success : colors.warning },
          });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Check-In', 'Days', 'Amount', 'Payment Status'];
        pdfRows = list.map((g) => [g.name, g.phone, getRoomLabel(g.roomId), getPropertyName(g.propertyId), g.checkInDate, String(g.numDays), `₹${g.totalAmount}`, g.paymentStatus]);
        break;
      }

      case 'room-occupancy':
      case 'vacant-rooms':
      case 'full-rooms': {
        const roomStats = rooms.map((room) => {
          const residentOccupants = residents.filter((r) => r.roomId === room.id).length;
          const guestOccupants = dailyGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g)).length;
          const occupants = residentOccupants + guestOccupants;
          const remaining = room.capacity - occupants;
          return { room, occupants, remaining, isFull: remaining <= 0 };
        });
        const relevant =
          reportId === 'vacant-rooms' ? roomStats.filter((r) => !r.isFull) : reportId === 'full-rooms' ? roomStats.filter((r) => r.isFull) : roomStats;

        const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
        const occupiedBeds = roomStats.reduce((s, r) => s + r.occupants, 0);
        const occPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

        kpis.push(
          { label: 'Total Rooms', value: String(rooms.length) },
          { label: 'Full Rooms', value: String(roomStats.filter((r) => r.isFull).length), color: colors.error },
          { label: 'Vacant Rooms', value: String(roomStats.filter((r) => !r.isFull).length), color: colors.success },
          { label: 'Occupancy', value: `${occPercent}%` }
        );
        relevant.forEach(({ room, occupants, remaining, isFull }) => {
          rows.push({
            primary: `${room.roomNumber} · Floor ${room.floor}`,
            secondary: `${getPropertyName(room.propertyId)} · ${room.capacity} Sharing`,
            tertiary: `${occupants}/${room.capacity} occupied`,
            badge: { label: isFull ? 'Full' : `${remaining} left`, color: isFull ? colors.error : colors.success },
          });
        });
        columns = ['Room', 'Floor', 'Property', 'Capacity', 'Occupied', 'Remaining'];
        pdfRows = relevant.map(({ room, occupants, remaining }) => [room.roomNumber, String(room.floor), getPropertyName(room.propertyId), String(room.capacity), String(occupants), String(remaining)]);
        break;
      }

      case 'rent-collection': {
        const paid = paymentRecords.filter((p) => p.status === 'Paid' && inRange(parsePaidOnDate(p.paidOn), start, end));
        kpis.push(
          { label: 'Payments', value: String(paid.length) },
          { label: 'Total Collected', value: `₹${paid.reduce((s, p) => s + p.amount, 0).toLocaleString()}` },
          { label: 'Early/On Time', value: String(paid.filter((p) => p.timing !== 'Late').length), color: colors.success },
          { label: 'Late', value: String(paid.filter((p) => p.timing === 'Late').length), color: colors.error }
        );
        paid.forEach((p) => {
          const resident = residents.find((r) => r.id === p.residentId);
          rows.push({
            primary: resident?.name ?? 'Unknown',
            secondary: `${p.month} · ₹${p.amount}`,
            tertiary: `Paid on ${p.paidOn} · ${p.method ?? '—'}`,
            badge: p.timing ? { label: p.timing, color: p.timing === 'Late' ? colors.error : colors.success } : undefined,
          });
        });
        columns = ['Resident', 'Month', 'Amount', 'Paid On', 'Method', 'Timing'];
        pdfRows = paid.map((p) => {
          const resident = residents.find((r) => r.id === p.residentId);
          return [resident?.name ?? 'Unknown', p.month, `₹${p.amount}`, p.paidOn ?? '—', p.method ?? '—', p.timing ?? '—'];
        });
        break;
      }

      case 'pending-dues': {
        const due = residents.filter((r) => r.rentStatus !== 'Paid');
        kpis.push(
          { label: 'Residents with Dues', value: String(due.length) },
          { label: 'Total Outstanding', value: `₹${due.reduce((s, r) => s + r.monthlyRent, 0).toLocaleString()}`, color: colors.error }
        );
        due.forEach((r) => {
          rows.push({
            primary: r.name,
            secondary: `${getRoomLabel(r.roomId)} · ${getPropertyName(r.propertyId)}`,
            tertiary: `₹${r.monthlyRent} due`,
            badge: { label: r.rentStatus, color: r.rentStatus === 'Overdue' ? colors.error : colors.warning },
          });
        });
        columns = ['Name', 'Phone', 'Room', 'Property', 'Amount Due', 'Status'];
        pdfRows = due.map((r) => [r.name, r.phone, getRoomLabel(r.roomId), getPropertyName(r.propertyId), `₹${r.monthlyRent}`, r.rentStatus]);
        break;
      }

      case 'revenue-summary': {
        const rentPaid = paymentRecords.filter((p) => p.status === 'Paid' && inRange(parsePaidOnDate(p.paidOn), start, end));
        const rentTotal = rentPaid.reduce((s, p) => s + p.amount, 0);
        const guests = dateRange === 'All Records' ? dailyGuests : dailyGuests.filter((g) => inRange(new Date(g.checkInTimestamp), start, end));
        const guestTotal = guests.reduce((s, g) => s + (g.advanceAmount ?? 0), 0);
        kpis.push(
          { label: 'Total Collected', value: `₹${(rentTotal + guestTotal).toLocaleString()}` },
          { label: 'Rent Collected', value: `₹${rentTotal.toLocaleString()}`, color: colors.success },
          { label: 'Day Guest Revenue', value: `₹${guestTotal.toLocaleString()}`, color: colors.primary },
          { label: 'Payments', value: String(rentPaid.length + guests.length) }
        );
        rentPaid.forEach((p) => {
          const resident = residents.find((r) => r.id === p.residentId);
          rows.push({ primary: resident?.name ?? 'Unknown', secondary: `Rent · ${p.month}`, tertiary: `₹${p.amount} on ${p.paidOn}` });
        });
        guests.forEach((g) => {
          rows.push({ primary: g.name, secondary: 'Day Guest', tertiary: `₹${g.advanceAmount ?? 0} · ${g.checkInDate}` });
        });
        columns = ['Name', 'Type', 'Amount', 'Date'];
        pdfRows = [
          ...rentPaid.map((p) => {
            const resident = residents.find((r) => r.id === p.residentId);
            return [resident?.name ?? 'Unknown', 'Rent', `₹${p.amount}`, p.paidOn ?? '—'];
          }),
          ...guests.map((g) => [g.name, 'Day Guest', `₹${g.advanceAmount ?? 0}`, g.checkInDate]),
        ];
        break;
      }

      case 'open-complaints':
      case 'resolved-complaints':
      case 'all-complaints': {
        const inWindow = dateRange === 'All Records' ? complaints : complaints.filter((c) => inRange(parseDisplayDate(c.date), start, end));
        const list =
          reportId === 'open-complaints'
            ? inWindow.filter((c) => c.status !== 'Resolved')
            : reportId === 'resolved-complaints'
            ? inWindow.filter((c) => c.status === 'Resolved')
            : inWindow;

        kpis.push(
          { label: 'Total', value: String(list.length) },
          { label: 'Open', value: String(list.filter((c) => c.status === 'Open').length), color: colors.error },
          { label: 'In Progress', value: String(list.filter((c) => c.status === 'In Progress').length), color: colors.warning },
          { label: 'Resolved', value: String(list.filter((c) => c.status === 'Resolved').length), color: colors.success }
        );
        list.forEach((c) => {
          rows.push({
            primary: `${c.residentName} · ${c.room}`,
            secondary: c.category,
            tertiary: `${c.description} · ${c.date}`,
            badge: { label: c.status, color: c.status === 'Open' ? colors.error : c.status === 'In Progress' ? colors.warning : colors.success },
          });
        });
        columns = ['Resident', 'Room', 'Category', 'Description', 'Date', 'Status'];
        pdfRows = list.map((c) => [c.residentName, c.room, c.category, c.description, c.date, c.status]);
        break;
      }

      default:
        break;
    }

    return { kpis, rows, columns, pdfRows };
  }, [reportId, residents, rooms, properties, dailyGuests, paymentRecords, complaints, dateRange, start, end, rangeLabel]);

  const buildReportHtml = (): string => {
    const headerCells = report.columns.map((c) => `<th>${c}</th>`).join('');
    const bodyRows = report.pdfRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
    const kpiCells = report.kpis
      .map((k) => `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`)
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
            .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
            .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
            .kpi-label { font-size: 10px; color: #888; text-transform: uppercase; }
            .kpi-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <div class="subtitle">Generated ${new Date().toLocaleString('en-GB')} · ${rangeLabel} · ${report.pdfRows.length} record(s)</div>
          <div class="kpis">${kpiCells}</div>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows || '<tr><td colspan="99">No records in this range.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleDownloadPdf = async () => {
    try {
      setExporting(true);
      const { uri } = await Print.printToFileAsync({ html: buildReportHtml(), base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: reportTitle, UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF Generated', `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Export Failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>{reportTitle}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[typography.caption, styles.sectionLabel]}>Date Range</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt} style={[styles.chip, dateRange === opt && styles.chipActive]} onPress={() => setDateRange(opt)}>
              <Text style={[typography.caption, { color: dateRange === opt ? colors.white : colors.text }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.rangeBanner}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.text, marginLeft: spacing.xs }]}>
            Selected Window: {dateRange} ({rangeLabel})
          </Text>
        </View>

        <Text style={[typography.caption, styles.sectionLabel, { marginTop: spacing.lg }]}>Key Highlights</Text>
        <View style={styles.kpiGrid}>
          {report.kpis.map((kpi) => (
            <View key={kpi.label} style={styles.kpiCard}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{kpi.label.toUpperCase()}</Text>
              <Text style={[typography.heading2, { color: kpi.color ?? colors.text, marginTop: 4 }]}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        <Text style={[typography.caption, styles.sectionLabel, { marginTop: spacing.lg }]}>
          Report Data Preview ({report.rows.length} records)
        </Text>
        {report.rows.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>No records found for this date range.</Text>
        ) : (
          report.rows.map((row, idx) => (
            <View key={idx} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{row.primary}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{row.secondary}</Text>
                {row.tertiary && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>{row.tertiary}</Text>}
              </View>
              {row.badge && (
                <View style={[styles.badge, { backgroundColor: `${row.badge.color}20` }]}>
                  <Text style={[typography.caption, { color: row.badge.color }]}>{row.badge.label}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.downloadButton, exporting && styles.downloadButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleDownloadPdf}
          disabled={exporting}
        >
          <Ionicons name="document-text-outline" size={18} color={colors.white} />
          <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>
            {exporting ? 'Generating...' : 'Download PDF'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  sectionLabel: { color: colors.textMuted, marginBottom: spacing.xs, letterSpacing: 0.5 },
  chipRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  rowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, marginLeft: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md },
  downloadButtonDisabled: { opacity: 0.6 },
});