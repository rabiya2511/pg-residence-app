import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';

/* ------------------------------------------------------------------ */
/* Settings you may want to change                                     */
/* ------------------------------------------------------------------ */

// Route names used for taps on this screen.
const ROOMS_ROUTE = 'AdminRooms';
const RESIDENT_DETAIL_ROUTE = 'AdminResidentDetail';

// A maintenance ticket that is still open after this many days counts as "Overdue".
const MAINTENANCE_SLA_DAYS = 3;

// Your app has no expense records yet, so the Expenses numbers are ₹0.
// When you add expense tracking, fill this list (or load it from your context)
// and every Expenses / Cash-Flow number on this screen updates automatically.
type ExpenseCategory =
  | 'Food & Kitchen'
  | 'Maintenance'
  | 'Utilities'
  | 'Cleaning & Housekeeping'
  | 'Staff & Salaries'
  | 'Miscellaneous';
type ExpenseEntry = {
  id: string;
  propertyId?: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // "dd MMM yyyy", e.g. "05 Sep 2026"
};
const EXPENSE_ENTRIES: ExpenseEntry[] = [];

const EXPENSE_CATEGORIES: { key: ExpenseCategory; color: string }[] = [
  { key: 'Food & Kitchen', color: '#F5A623' },
  { key: 'Maintenance', color: '#F26B0F' },
  { key: 'Utilities', color: '#2BA8E0' },
  { key: 'Cleaning & Housekeeping', color: '#2EB872' },
  { key: 'Staff & Salaries', color: '#9B51E0' },
  { key: 'Miscellaneous', color: '#6B7280' },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Parses "25 Sep 2026" (dd MMM yyyy) into a Date.
function parseDisplayDate(str?: string | null): Date | null {
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return null;
  return new Date(Number(m[3]), monthIdx, Number(m[1]));
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const formatShort = (n: number) =>
  n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
const formatDay = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';
type Range = { start: Date; end: Date };

function getRange(key: PeriodKey, custom: Range): Range {
  const now = new Date();
  switch (key) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'week': {
      const offset = (now.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      return { start: startOfDay(monday), end: endOfDay(now) };
    }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case 'lastMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case 'custom':
    default:
      return { start: startOfDay(custom.start), end: endOfDay(custom.end) };
  }
}

const inRange = (dateStr: string | null | undefined, range: Range) => {
  const d = parseDisplayDate(dateStr);
  return !!d && d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom Date Range' },
];

type SectionKey =
  | 'overview'
  | 'occupancy'
  | 'revenue'
  | 'dues'
  | 'residents'
  | 'rooms'
  | 'maintenance'
  | 'operations'
  | 'expenses'
  | 'properties'
  | 'trends';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'occupancy', label: 'Occupancy' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'dues', label: 'Dues' },
  { key: 'residents', label: 'Residents' },
  { key: 'rooms', label: 'Rooms & Vacancy' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'operations', label: 'Operations' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'properties', label: 'Properties' },
  { key: 'trends', label: 'Trends' },
];

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      {icon && (
        <Ionicons name={icon} size={14} color={active ? colors.white : colors.text} style={{ marginRight: 6 }} />
      )}
      <Text
        style={[
          typography.caption,
          { color: active ? colors.white : colors.text, fontWeight: '600', lineHeight: 18 },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  onPress,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
      <View style={styles.statTop}>
        <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '600', flex: 1 }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      </View>
      <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.xs }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.caption, { color, fontWeight: '600', marginTop: 2 }]} numberOfLines={1}>
        {sub}
      </Text>
    </TouchableOpacity>
  );
}

function MetricGrid({ items }: { items: { label: string; value: string | number; color?: string }[] }) {
  return (
    <View style={styles.metricGrid}>
      {items.map((it) => (
        <View key={it.label} style={styles.metric}>
          <Text style={[typography.heading3, { color: it.color ?? colors.text }]} numberOfLines={1}>
            {it.value}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          width: `${Math.min(100, Math.max(0, percent))}%`,
        }}
      />
    </View>
  );
}

function Gauge({ percent, caption }: { percent: number; caption: string }) {
  const size = 190;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const filled = (arc * Math.min(100, Math.max(0, percent))) / 100;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.border}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
            rotation="135"
            origin={`${size / 2}, ${size / 2}`}
          />
          {filled > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={colors.warning}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${filled} ${c}`}
              strokeLinecap="round"
              rotation="135"
              origin={`${size / 2}, ${size / 2}`}
            />
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[typography.heading2, { color: colors.text }]}>{percent}%</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text>
        </View>
      </View>
    </View>
  );
}

function BarChart({
  data,
  color,
  format,
}: {
  data: { label: string; value: number }[];
  color: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.chartBox}>
      {data.map((d) => (
        <View key={d.label} style={styles.barCol}>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
            {format ? format(d.value) : d.value}
          </Text>
          <View
            style={{
              width: 22,
              height: Math.max(4, (d.value / max) * 110),
              backgroundColor: color,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              marginVertical: 4,
            }}
          />
          <Text style={[typography.caption, { color: colors.text, fontSize: 11 }]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ListRow({
  title,
  subtitle,
  right,
  rightColor,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightColor?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.listRow} activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!right && (
        <View style={[styles.rightPill, { backgroundColor: `${rightColor ?? colors.primary}20` }]}>
          <Text style={[typography.caption, { color: rightColor ?? colors.primary, fontWeight: '700' }]}>{right}</Text>
        </View>
      )}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />}
    </TouchableOpacity>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md }]}>
      {text}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function AdminAnalyticsScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, dailyGuests, paymentRecords, complaints, identityDocuments, properties } = useAdmin();

  const [propertyFilter, setPropertyFilter] = useState<string | 'all'>('all');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [section, setSection] = useState<SectionKey>('overview');
  const [customRange, setCustomRange] = useState<Range>({ start: new Date(), end: new Date() });
  const [customModal, setCustomModal] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [propertyModal, setPropertyModal] = useState(false);
  const [trendUnit, setTrendUnit] = useState<'day' | 'week' | 'month'>('day');

  const range = useMemo(() => getRange(period, customRange), [period, customRange]);
  const periodLabel =
    period === 'custom'
      ? `${formatDay(range.start)} – ${formatDay(range.end)}`
      : PERIODS.find((p) => p.key === period)?.label ?? '';

  const selectedPropertyName =
    propertyFilter === 'all' ? 'All Properties' : properties.find((p) => p.id === propertyFilter)?.name ?? 'Property';

  /* ---------------- data, scoped to the selected property ---------------- */

  const data = useMemo(() => {
    const inProp = (pid: string) => propertyFilter === 'all' || pid === propertyFilter;

    const sRooms = rooms.filter((r) => inProp(r.propertyId));
    const sResidents = residents.filter((r) => inProp(r.propertyId));
    const sGuests = dailyGuests.filter((g) => inProp(g.propertyId));
    const residentIds = new Set(sResidents.map((r) => r.id));
    const residentNames = new Set(sResidents.map((r) => r.name));
    const sPayments = paymentRecords.filter((p) => residentIds.has(p.residentId));
    const sComplaints = complaints.filter((c) => residentNames.has(c.residentName));
    const sDocs = identityDocuments.filter((d) => residentIds.has(d.residentId));
    const sExpenses = EXPENSE_ENTRIES.filter((e) => !e.propertyId || inProp(e.propertyId));

    // rooms with occupancy
    const roomRows = sRooms
      .map((room) => {
        const res = sResidents.filter((r) => r.roomId === room.id).length;
        const gst = sGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g)).length;
        const occupied = Math.min(room.capacity, res + gst);
        return {
          id: room.id,
          propertyId: room.propertyId,
          floor: room.floor,
          roomNumber: room.roomNumber,
          capacity: room.capacity,
          occupied,
          vacant: room.capacity - occupied,
        };
      })
      .sort(
        (a, b) => a.floor - b.floor || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
      );

    const totalBeds = roomRows.reduce((s, r) => s + r.capacity, 0);
    const occupiedBeds = roomRows.reduce((s, r) => s + r.occupied, 0);
    const occupancyPercent = totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100);

    // revenue in the selected period
    const paidInRange = sPayments.filter((p) => p.status === 'Paid' && inRange(p.paidOn, range));
    const rentCollected = paidInRange.reduce((s, p) => s + p.amount, 0);
    const guestsInRange = sGuests.filter((g) => inRange(g.checkInDate, range));
    const guestRevenue = guestsInRange.reduce((s, g) => s + (g.advanceAmount ?? 0), 0);
    const collections = rentCollected + guestRevenue;

    const byMethod: Record<string, number> = {};
    paidInRange.forEach((p) => {
      const m = (p.method as string | undefined) ?? 'Other';
      byMethod[m] = (byMethod[m] ?? 0) + p.amount;
    });
    guestsInRange.forEach((g) => {
      const m = (g.paymentMethod as string | undefined) ?? 'Other';
      byMethod[m] = (byMethod[m] ?? 0) + (g.advanceAmount ?? 0);
    });

    // dues (current, not limited to the period)
    const unpaid = sPayments.filter((p) => p.status !== 'Paid');
    const dueTotal = unpaid.reduce((s, p) => s + p.amount, 0);
    const defaulterMap = new Map<string, { id: string; name: string; amount: number; overdue: boolean }>();
    unpaid.forEach((p) => {
      const res = sResidents.find((r) => r.id === p.residentId);
      if (!res) return;
      const cur = defaulterMap.get(res.id) ?? { id: res.id, name: res.name, amount: 0, overdue: false };
      cur.amount += p.amount;
      if (p.status === 'Overdue') cur.overdue = true;
      defaulterMap.set(res.id, cur);
    });
    const defaulters = Array.from(defaulterMap.values()).sort((a, b) => b.amount - a.amount);

    // residents
    const activeResidents = sResidents.filter((r) => !r.vacatingDate);
    const vacatingResidents = sResidents.filter((r) => !!r.vacatingDate);
    const newJoiners = sResidents.filter((r) => inRange(r.joiningDate, range));
    const genderCount: Record<string, number> = {};
    sResidents.forEach((r) => {
      genderCount[r.gender] = (genderCount[r.gender] ?? 0) + 1;
    });

    // maintenance (complaints act as maintenance tickets)
    const statusOf = (c: { status: unknown }) => String(c.status).toLowerCase();
    const isResolved = (c: { status: unknown }) => statusOf(c).includes('resolv') || statusOf(c).includes('clos');
    const isProgress = (c: { status: unknown }) => statusOf(c).includes('progress');
    const ticketsInRange = sComplaints.filter((c) => inRange(c.date, range));
    const openTickets = ticketsInRange.filter((c) => !isResolved(c) && !isProgress(c));
    const progressTickets = ticketsInRange.filter(isProgress);
    const resolvedTickets = ticketsInRange.filter(isResolved);
    const now = Date.now();
    const overdueTickets = ticketsInRange.filter((c) => {
      if (isResolved(c)) return false;
      const d = parseDisplayDate(c.date);
      return !!d && now - d.getTime() > MAINTENANCE_SLA_DAYS * 24 * 60 * 60 * 1000;
    });
    const emergencyTickets = ticketsInRange.filter((c) => String(c.category).toLowerCase().includes('emergency'));
    const categoryMap = new Map<string, { total: number; open: number }>();
    ticketsInRange.forEach((c) => {
      const cur = categoryMap.get(c.category) ?? { total: 0, open: 0 };
      cur.total += 1;
      if (!isResolved(c)) cur.open += 1;
      categoryMap.set(c.category, cur);
    });
    const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1].total - a[1].total);

    // expenses
    const expensesInRange = sExpenses.filter((e) => inRange(e.date, range));
    const totalSpend = expensesInRange.reduce((s, e) => s + e.amount, 0);
    const spendByCategory = EXPENSE_CATEGORIES.map((cat) => ({
      ...cat,
      amount: expensesInRange.filter((e) => e.category === cat.key).reduce((s, e) => s + e.amount, 0),
    }));
    const maintenanceSpend = spendByCategory.find((c) => c.key === 'Maintenance')?.amount ?? 0;

    // operations
    const docsPending = sDocs.filter((d) => !d.frontUri || !d.backUri).length;
    const activeGuests = sGuests.filter((g) => isDailyGuestActiveNow(g)).length;

    return {
      sPayments,
      sResidents,
      sGuests,
      sComplaints,
      sExpenses,
      roomRows,
      totalBeds,
      occupiedBeds,
      occupancyPercent,
      rentCollected,
      paidCount: paidInRange.length,
      guestRevenue,
      collections,
      byMethod,
      unpaid,
      dueTotal,
      defaulters,
      activeResidents,
      vacatingResidents,
      newJoiners,
      genderCount,
      ticketsInRange,
      openTickets,
      progressTickets,
      resolvedTickets,
      overdueTickets,
      emergencyTickets,
      categories,
      totalSpend,
      spendByCategory,
      maintenanceSpend,
      expenseCount: expensesInRange.length,
      docsPending,
      activeGuests,
    };
  }, [propertyFilter, rooms, residents, dailyGuests, paymentRecords, complaints, identityDocuments, range]);

  const netBalance = data.collections - data.totalSpend;
  const partialRooms = data.roomRows.filter((r) => r.occupied > 0 && r.occupied < r.capacity).length;
  const fullRooms = data.roomRows.filter((r) => r.occupied >= r.capacity).length;
  const vacantRooms = data.roomRows.filter((r) => r.occupied === 0).length;

  /* ---------------- trend helpers ---------------- */

  const monthBuckets = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));
      return { label: MONTHS_3[start.getMonth()], start, end };
    });
  }, []);

  const collectionsTrend = monthBuckets.map((b) => ({
    label: b.label,
    value: data.sPayments
      .filter((p) => p.status === 'Paid' && inRange(p.paidOn, b))
      .reduce((s, p) => s + p.amount, 0),
  }));
  const joinersTrend = monthBuckets.map((b) => ({
    label: b.label,
    value: data.sResidents.filter((r) => inRange(r.joiningDate, b)).length,
  }));
  const expenseTrend = monthBuckets.slice(1).map((b) => ({
    label: b.label,
    value: data.sExpenses.filter((e) => inRange(e.date, b)).reduce((s, e) => s + e.amount, 0),
  }));

  const ticketTrend = useMemo(() => {
    const now = new Date();
    const count = (r: Range) => data.sComplaints.filter((c) => inRange(c.date, r)).length;
    if (trendUnit === 'day') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
        return { label: WEEKDAYS_3[d.getDay()], value: count({ start: startOfDay(d), end: endOfDay(d) }) };
      });
    }
    if (trendUnit === 'week') {
      return Array.from({ length: 6 }, (_, i) => {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (5 - i) * 7);
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
        return { label: `${start.getDate()} ${MONTHS_3[start.getMonth()]}`, value: count({ start: startOfDay(start), end: endOfDay(end) }) };
      });
    }
    return monthBuckets.map((b) => ({ label: b.label, value: count(b) }));
  }, [trendUnit, data.sComplaints, monthBuckets]);

  /* ---------------- actions ---------------- */

  const goRooms = () => navigation.navigate(ROOMS_ROUTE);
  const goResident = (id: string) => navigation.navigate(RESIDENT_DETAIL_ROUTE, { residentId: id });

  const handleExport = async () => {
    const lines = [
      `Analytics & Insights — ${selectedPropertyName}`,
      `Period: ${periodLabel}`,
      '',
      `Residents: ${data.sResidents.length} (${data.activeResidents.length} active)`,
      `Occupancy: ${data.occupancyPercent}% (${data.occupiedBeds}/${data.totalBeds} beds)`,
      `Rent collected: ${formatINR(data.rentCollected)} (${data.paidCount} payments)`,
      `Day guest revenue: ${formatINR(data.guestRevenue)}`,
      `Pending dues: ${formatINR(data.dueTotal)} (${data.defaulters.length} defaulters)`,
      `Expenses: ${formatINR(data.totalSpend)}`,
      `Net balance: ${formatINR(netBalance)}`,
      `Maintenance tickets: ${data.ticketsInRange.length} (${data.openTickets.length} open)`,
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const handlePickerChange = (_event: any, selected?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!selected || !target) return;
    setCustomRange((prev) => {
      const next = { ...prev, [target]: selected };
      if (next.start.getTime() > next.end.getTime()) {
        return target === 'start' ? { ...next, end: selected } : { ...next, start: selected };
      }
      return next;
    });
  };

  /* ---------------- sections ---------------- */

  const renderOverview = () => (
    <>
      <View style={styles.statGrid}>
        <StatCard
        label="Total Residents"
        value={data.sResidents.length}
        sub={`${data.activeResidents.length} Active`}
        icon="people"
        color={colors.primary}
        onPress={() => setSection('residents')}
        />
        <StatCard
        label="Occupancy Rate"
        value={`${data.occupancyPercent}%`}
        sub={`${data.occupiedBeds} / ${data.totalBeds} Beds`}
        icon="bed"
        color={data.occupancyPercent >= 70 ? colors.success : colors.warning}
        onPress={() => setSection('occupancy')}
        />
        <StatCard
        label="Rent Collected"
        value={formatINR(data.rentCollected)}
        sub={`${data.paidCount} payments`}
        icon="receipt"
        color={colors.success}
        onPress={() => setSection('revenue')}
        />
        <StatCard
        label="Pending Dues"
        value={formatINR(data.dueTotal)}
        sub={`${data.defaulters.length} Defaulters`}
        icon="alert-circle"
        color={colors.error}
        onPress={() => setSection('dues')}
        />
        <StatCard
        label="Operating Expenses"
        value={formatINR(data.totalSpend)}
        sub={`${data.expenseCount} entries`}
        icon="cash"
        color={colors.primary}
        onPress={() => setSection('expenses')}
        />
        <StatCard
        label="Maintenance Cost"
        value={formatINR(data.maintenanceSpend)}
        sub={`${data.ticketsInRange.length} tickets`}
        icon="construct"
        color={colors.primary}
        onPress={() => setSection('maintenance')}
        />
      </View>

      <Card
        title="Occupancy Rate"
        right={
          <View style={[styles.badge, { backgroundColor: `${colors.warning}20` }]}>
            <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
              {data.occupancyPercent >= 90 ? 'Almost Full' : 'Capacity Available'}
            </Text>
          </View>
        }
      >
        <Gauge percent={data.occupancyPercent} caption={`${data.occupiedBeds} / ${data.totalBeds} Beds`} />
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.warning }]} />
            <View>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{data.occupiedBeds}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Occupied</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
            <View>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{data.totalBeds - data.occupiedBeds}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Vacant</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card
        title="Cash Flow & Net Profit"
        right={
          <View
            style={[styles.badge, { backgroundColor: `${netBalance >= 0 ? colors.success : colors.error}20` }]}
          >
            <Text
              style={[typography.caption, { color: netBalance >= 0 ? colors.success : colors.error, fontWeight: '700' }]}
            >
              {netBalance >= 0 ? 'Net Surplus' : 'Net Deficit'}
            </Text>
          </View>
        }
      >
        <MetricGrid
          items={[
            { label: 'Collections', value: formatINR(data.collections), color: colors.success },
            { label: 'Total Spend', value: formatINR(data.totalSpend), color: colors.warning },
            { label: 'Net Balance', value: formatINR(netBalance), color: netBalance >= 0 ? colors.success : colors.error },
          ]}
        />
        <ProgressBar
          percent={data.collections === 0 ? 0 : (Math.max(0, netBalance) / data.collections) * 100}
          color={colors.success}
        />
      </Card>

      <View style={styles.linkRow}>
        <TouchableOpacity style={styles.linkCard} activeOpacity={0.85} onPress={goRooms}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>Occupancy Hub</Text>
            <Text style={[typography.caption, { color: colors.warning, marginTop: 4 }]}>
              {data.totalBeds - data.occupiedBeds} beds free
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkCard} activeOpacity={0.85} onPress={() => setSection('dues')}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>Dues & Defaulters</Text>
            <Text style={[typography.caption, { color: colors.warning, marginTop: 4 }]}>
              {formatINR(data.dueTotal)} due
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </>
  );

  const renderOccupancy = () => {
    const floors = Array.from(new Set(data.roomRows.map((r) => r.floor))).sort((a, b) => a - b);
    const sharingTypes = Array.from(new Set(data.roomRows.map((r) => r.capacity))).sort((a, b) => a - b);
    return (
      <>
        <Card title="Occupancy Overview">
          <Gauge percent={data.occupancyPercent} caption={`${data.occupiedBeds} / ${data.totalBeds} Beds`} />
          <MetricGrid
            items={[
              { label: 'Full Rooms', value: fullRooms, color: colors.success },
              { label: 'Partial Rooms', value: partialRooms, color: colors.warning },
              { label: 'Vacant Rooms', value: vacantRooms, color: colors.error },
            ]}
          />
        </Card>
        <Card title="Occupancy by Floor">
          {floors.length === 0 && <EmptyNote text="No rooms yet." />}
          {floors.map((f) => {
            const rows = data.roomRows.filter((r) => r.floor === f);
            const cap = rows.reduce((s, r) => s + r.capacity, 0);
            const occ = rows.reduce((s, r) => s + r.occupied, 0);
            const pct = cap === 0 ? 0 : Math.round((occ / cap) * 100);
            return (
              <View key={f} style={{ marginBottom: spacing.sm }}>
                <View style={styles.between}>
                  <Text style={[typography.body, { color: colors.text }]}>Floor {f}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {occ}/{cap} beds · {pct}%
                  </Text>
                </View>
                <ProgressBar percent={pct} color={colors.warning} />
              </View>
            );
          })}
        </Card>
        <Card title="Occupancy by Sharing Type">
          {sharingTypes.length === 0 && <EmptyNote text="No rooms yet." />}
          {sharingTypes.map((cap) => {
            const rows = data.roomRows.filter((r) => r.capacity === cap);
            const total = rows.reduce((s, r) => s + r.capacity, 0);
            const occ = rows.reduce((s, r) => s + r.occupied, 0);
            const pct = total === 0 ? 0 : Math.round((occ / total) * 100);
            return (
              <View key={cap} style={{ marginBottom: spacing.sm }}>
                <View style={styles.between}>
                  <Text style={[typography.body, { color: colors.text }]}>
                    {cap} Sharing ({rows.length} rooms)
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {occ}/{total} beds · {pct}%
                  </Text>
                </View>
                <ProgressBar percent={pct} color={colors.primary} />
              </View>
            );
          })}
        </Card>
      </>
    );
  };

  const renderRevenue = () => {
    const methods = Object.entries(data.byMethod).sort((a, b) => b[1] - a[1]);
    return (
      <>
        <Card title="Revenue Summary">
          <Text style={[typography.heading2, { color: colors.success }]}>{formatINR(data.collections)}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            Total collected · {periodLabel}
          </Text>
          <MetricGrid
            items={[
              { label: 'Rent Collected', value: formatINR(data.rentCollected), color: colors.success },
              { label: 'Day Guests', value: formatINR(data.guestRevenue), color: colors.warning },
              { label: 'Payments', value: data.paidCount, color: colors.primary },
            ]}
          />
        </Card>
        <Card title="Collections by Payment Method">
          {methods.length === 0 && <EmptyNote text="No payments in this period." />}
          {methods.map(([method, amount]) => (
            <View key={method} style={{ marginBottom: spacing.sm }}>
              <View style={styles.between}>
                <Text style={[typography.body, { color: colors.text }]}>{method}</Text>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{formatINR(amount)}</Text>
              </View>
              <ProgressBar percent={data.collections === 0 ? 0 : (amount / data.collections) * 100} color={colors.success} />
            </View>
          ))}
        </Card>
        <Card title="Recent Payments">
          {data.sPayments.filter((p) => p.status === 'Paid' && inRange(p.paidOn, range)).length === 0 && (
            <EmptyNote text="No payments in this period." />
          )}
          {data.sPayments
            .filter((p) => p.status === 'Paid' && inRange(p.paidOn, range))
            .slice(0, 8)
            .map((p) => {
              const res = data.sResidents.find((r) => r.id === p.residentId);
              return (
                <ListRow
                  key={p.id}
                  title={res?.name ?? 'Resident'}
                  subtitle={`${p.month} · ${p.paidOn ?? ''}`}
                  right={formatINR(p.amount)}
                  rightColor={colors.success}
                  onPress={res ? () => goResident(res.id) : undefined}
                />
              );
            })}
        </Card>
      </>
    );
  };

  const renderDues = () => (
    <>
      <Card title="Dues Overview">
        <MetricGrid
          items={[
            { label: 'Total Due', value: formatINR(data.dueTotal), color: colors.error },
            { label: 'Defaulters', value: data.defaulters.length, color: colors.warning },
            { label: 'Overdue', value: data.defaulters.filter((d) => d.overdue).length, color: colors.error },
          ]}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Dues show what is unpaid right now, whatever period is selected.
        </Text>
      </Card>
      <Card title="Defaulters">
        {data.defaulters.length === 0 && <EmptyNote text="No pending dues. 🎉" />}
        {data.defaulters.map((d) => (
          <ListRow
            key={d.id}
            title={d.name}
            subtitle={d.overdue ? 'Overdue' : 'Pending'}
            right={formatINR(d.amount)}
            rightColor={d.overdue ? colors.error : colors.warning}
            onPress={() => goResident(d.id)}
          />
        ))}
      </Card>
    </>
  );

  const renderResidents = () => (
    <>
      <Card title="Residents Overview">
        <MetricGrid
          items={[
            { label: 'Total', value: data.sResidents.length },
            { label: 'Active', value: data.activeResidents.length, color: colors.success },
            { label: 'Vacating', value: data.vacatingResidents.length, color: colors.error },
            { label: `Joined (${periodLabel})`, value: data.newJoiners.length, color: colors.warning },
            { label: 'Day Guests Now', value: data.activeGuests, color: colors.primary },
          ]}
        />
      </Card>
      <Card title="Gender Split">
        {Object.keys(data.genderCount).length === 0 && <EmptyNote text="No residents yet." />}
        {Object.entries(data.genderCount).map(([g, n]) => (
          <View key={g} style={{ marginBottom: spacing.sm }}>
            <View style={styles.between}>
              <Text style={[typography.body, { color: colors.text }]}>{g}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{n}</Text>
            </View>
            <ProgressBar percent={data.sResidents.length === 0 ? 0 : (n / data.sResidents.length) * 100} color={colors.primary} />
          </View>
        ))}
      </Card>
      <Card title="Vacating Soon">
        {data.vacatingResidents.length === 0 && <EmptyNote text="No residents are vacating." />}
        {data.vacatingResidents.map((r) => (
          <ListRow
            key={r.id}
            title={r.name}
            subtitle={`Vacating ${r.vacatingDate}`}
            right="Exit"
            rightColor={colors.error}
            onPress={() => goResident(r.id)}
          />
        ))}
      </Card>
      <Card title="New Joiners">
        {data.newJoiners.length === 0 && <EmptyNote text="No new residents in this period." />}
        {data.newJoiners.map((r) => (
          <ListRow key={r.id} title={r.name} subtitle={`Joined ${r.joiningDate}`} onPress={() => goResident(r.id)} />
        ))}
      </Card>
    </>
  );

  const renderRooms = () => (
    <>
      <Card title="Room & Vacancy Overview">
        <MetricGrid
          items={[
            { label: 'Total Rooms', value: data.roomRows.length },
            { label: 'Occupied', value: fullRooms, color: colors.warning },
            { label: 'Partial', value: partialRooms, color: colors.warning },
            { label: 'Fully Vacant', value: vacantRooms, color: colors.success },
            { label: 'Available Beds', value: `${data.totalBeds - data.occupiedBeds} Beds`, color: colors.success },
            { label: 'Capacity', value: `${data.totalBeds} Beds` },
          ]}
        />
      </Card>
      <Card
        title="Vacancy by Room Chart"
        right={<Text style={[typography.caption, { color: colors.textMuted }]}>Tap room to open details</Text>}
      >
        {data.roomRows.length === 0 && <EmptyNote text="No rooms yet." />}
        {data.roomRows.map((room) => {
          const color = room.vacant === 0 ? colors.error : room.occupied === 0 ? colors.success : colors.warning;
          const propName =
            propertyFilter === 'all' ? properties.find((p) => p.id === room.propertyId)?.name : undefined;
          return (
            <ListRow
              key={room.id}
              title={`Room ${room.roomNumber} (Floor ${room.floor})`}
              subtitle={`${propName ? `${propName} · ` : ''}${room.capacity} Sharing · ${room.occupied}/${room.capacity} filled`}
              right={room.vacant === 0 ? 'Full' : `${room.vacant} vacant`}
              rightColor={color}
              onPress={goRooms}
            />
          );
        })}
      </Card>
    </>
  );

  const renderMaintenance = () => (
    <>
      <Card title="Maintenance Overview & SLA">
        <MetricGrid
          items={[
            { label: 'Total Requests', value: data.ticketsInRange.length },
            { label: 'Open Issues', value: data.openTickets.length, color: colors.error },
            { label: 'In Progress', value: data.progressTickets.length, color: colors.warning },
            { label: 'Resolved', value: data.resolvedTickets.length, color: colors.success },
            { label: 'Overdue', value: data.overdueTickets.length, color: colors.error },
            { label: 'Emergency', value: data.emergencyTickets.length, color: colors.warning },
          ]}
        />
        <View style={[styles.between, styles.divider]}>
          <Text style={[typography.body, { color: colors.text }]}>Total Maintenance Spend</Text>
          <Text style={[typography.heading3, { color: colors.warning }]}>{formatINR(data.maintenanceSpend)}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Overdue = still unresolved after {MAINTENANCE_SLA_DAYS} days.
        </Text>
      </Card>
      <Card
        title="Maintenance Requests Trend"
        right={
          <View style={styles.segment}>
            {(['day', 'week', 'month'] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.segmentItem, trendUnit === u && { backgroundColor: colors.warning }]}
                onPress={() => setTrendUnit(u)}
              >
                <Text
                  style={[typography.caption, { color: trendUnit === u ? colors.white : colors.text, fontWeight: '600' }]}
                >
                  {u === 'day' ? 'Day' : u === 'week' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      >
        <BarChart data={ticketTrend} color={colors.warning} />
      </Card>
      <Card title="Maintenance by Category">
        {data.categories.length === 0 && <EmptyNote text="No requests in this period." />}
        {data.categories.map(([cat, v]) => (
          <ListRow
            key={cat}
            title={cat}
            subtitle={`${v.total} total · ${v.open} open`}
            right={formatINR(0)}
            rightColor={colors.warning}
            onPress={() => navigation.navigate('AdminComplaints')}
          />
        ))}
      </Card>
    </>
  );

  const renderOperations = () => (
    <>
      <Card title="Operations Snapshot">
        <MetricGrid
          items={[
            { label: 'Pending Rent', value: data.defaulters.length, color: colors.error },
            { label: 'Open Complaints', value: data.openTickets.length, color: colors.warning },
            { label: 'Documents Pending', value: data.docsPending, color: colors.primary },
            { label: 'Vacate Notices', value: data.vacatingResidents.length, color: colors.error },
            { label: 'Day Guests Now', value: data.activeGuests, color: colors.success },
            { label: 'New Joiners', value: data.newJoiners.length, color: colors.warning },
          ]}
        />
      </Card>
      <Card title="Complaint Resolution">
        <View style={styles.between}>
          <Text style={[typography.body, { color: colors.text }]}>Resolved</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {data.resolvedTickets.length}/{data.ticketsInRange.length}
          </Text>
        </View>
        <ProgressBar
          percent={data.ticketsInRange.length === 0 ? 0 : (data.resolvedTickets.length / data.ticketsInRange.length) * 100}
          color={colors.success}
        />
      </Card>
      <Card title="Quick Actions">
        <ListRow title="Open Rooms & Beds" subtitle="Assign residents, add rooms" onPress={goRooms} />
        <ListRow title="Complaints" subtitle="Review and update status" onPress={() => navigation.navigate('AdminComplaints')} />
        <ListRow title="Identity Documents" subtitle="Pending uploads" onPress={() => navigation.navigate('AdminIdentityDocuments')} />
        <ListRow title="Send Notice" subtitle="Message all residents" onPress={() => navigation.navigate('AdminNotices')} />
      </Card>
    </>
  );

  const renderExpenses = () => (
    <>
      <Card title="Operating Expense Breakdown">
        <Text style={[typography.heading2, { color: colors.warning }]}>{formatINR(data.totalSpend)} Total Spending</Text>
        <View style={{ height: spacing.sm }} />
        <View style={styles.metricGrid}>
          {data.spendByCategory.map((c) => (
            <View key={c.key} style={styles.metric}>
              <Text style={[typography.heading3, { color: c.color }]} numberOfLines={1}>
                {formatINR(c.amount)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
                {c.key}
              </Text>
            </View>
          ))}
        </View>
        {EXPENSE_ENTRIES.length === 0 && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No expenses recorded yet. Add entries to EXPENSE_ENTRIES at the top of this file to see them here.
          </Text>
        )}
      </Card>
      <Card title="Monthly Expense Trend">
        <BarChart data={expenseTrend} color={colors.warning} format={formatShort} />
      </Card>
    </>
  );

  const renderProperties = () => (
    <>
      {properties.length === 0 && <Card><EmptyNote text="No properties yet." /></Card>}
      {properties.map((p) => {
        const rows = rooms.filter((r) => r.propertyId === p.id);
        const beds = rows.reduce((s, r) => s + r.capacity, 0);
        const res = residents.filter((r) => r.propertyId === p.id);
        const resIds = new Set(res.map((r) => r.id));
        const guestsHere = dailyGuests.filter((g) => g.propertyId === p.id && isDailyGuestActiveNow(g)).length;
        const occupied = Math.min(beds, res.length + guestsHere);
        const pct = beds === 0 ? 0 : Math.round((occupied / beds) * 100);
        const revenue = paymentRecords
          .filter((pay) => resIds.has(pay.residentId) && pay.status === 'Paid' && inRange(pay.paidOn, range))
          .reduce((s, pay) => s + pay.amount, 0);
        return (
          <Card key={p.id} title={p.name}>
            <MetricGrid
              items={[
                { label: 'Rooms', value: rows.length },
                { label: 'Beds', value: beds },
                { label: 'Residents', value: res.length, color: colors.primary },
                { label: 'Occupancy', value: `${pct}%`, color: colors.warning },
                { label: 'Revenue', value: formatINR(revenue), color: colors.success },
              ]}
            />
            <ProgressBar percent={pct} color={colors.warning} />
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => {
                setPropertyFilter(p.id);
                setSection('overview');
              }}
            >
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>View analytics</Text>
            </TouchableOpacity>
          </Card>
        );
      })}
    </>
  );

  const renderTrends = () => (
    <>
      <Card title="Collections — Last 6 Months">
        <BarChart data={collectionsTrend} color={colors.success} format={formatShort} />
      </Card>
      <Card title="New Residents — Last 6 Months">
        <BarChart data={joinersTrend} color={colors.primary} />
      </Card>
      <Card title="Maintenance Requests — Last 6 Months">
        <BarChart data={monthBuckets.map((b) => ({ label: b.label, value: data.sComplaints.filter((c) => inRange(c.date, b)).length }))} color={colors.warning} />
      </Card>
    </>
  );

  const renderSection = () => {
    switch (section) {
      case 'occupancy':
        return renderOccupancy();
      case 'revenue':
        return renderRevenue();
      case 'dues':
        return renderDues();
      case 'residents':
        return renderResidents();
      case 'rooms':
        return renderRooms();
      case 'maintenance':
        return renderMaintenance();
      case 'operations':
        return renderOperations();
      case 'expenses':
        return renderExpenses();
      case 'properties':
        return renderProperties();
      case 'trends':
        return renderTrends();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  /* ---------------- render ---------------- */

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
     
       <View style={styles.header}>
  <View style={{ flex: 1 }}>
    <Text style={[typography.heading2, { color: colors.text }]}>Analytics & Insights</Text>
    <TouchableOpacity style={styles.propertyButton} activeOpacity={0.85} onPress={() => setPropertyModal(true)}>
      <Ionicons name="business-outline" size={14} color={colors.primary} />
      <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginHorizontal: 6 }]} numberOfLines={1}>
        {selectedPropertyName}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.primary} />
    </TouchableOpacity>
  </View>
  <TouchableOpacity onPress={handleExport} style={styles.headerButton}>
    <Ionicons name="download-outline" size={22} color={colors.text} />
  </TouchableOpacity>
</View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
        {PERIODS.map((p) => (
          <Chip
            key={p.key}
            label={p.key === 'custom' && period === 'custom' ? periodLabel : p.label}
            icon={p.key === 'custom' ? 'calendar-outline' : undefined}
            active={period === p.key}
            onPress={() => {
              if (p.key === 'custom') setCustomModal(true);
              else setPeriod(p.key);
            }}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
        {SECTIONS.map((s) => (
          <Chip key={s.key} label={s.label} active={section === s.key} onPress={() => setSection(s.key)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderSection()}
      </ScrollView>

      {/* Property picker */}
      <Modal visible={propertyModal} transparent animationType="fade" onRequestClose={() => setPropertyModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPropertyModal(false)}>
          <View style={styles.modalSheet}>
            {[{ id: 'all', name: 'All Properties' }, ...properties].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.modalOption}
                onPress={() => {
                  setPropertyFilter(p.id);
                  setPropertyModal(false);
                }}
              >
                <Text
                  style={[
                    typography.body,
                    { color: propertyFilter === p.id ? colors.warning : colors.text, fontWeight: propertyFilter === p.id ? '700' : '400' },
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom date range */}
      <Modal visible={customModal} transparent animationType="fade" onRequestClose={() => setCustomModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, padding: spacing.md }]}>Custom Date Range</Text>
            <TouchableOpacity style={styles.dateRow} onPress={() => setPickerTarget('start')}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>From</Text>
              <Text style={[typography.body, { color: colors.text }]}>{formatDay(customRange.start)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateRow} onPress={() => setPickerTarget('end')}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>To</Text>
              <Text style={[typography.body, { color: colors.text }]}>{formatDay(customRange.end)}</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCustomModal(false)}>
                <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => {
                  setPeriod('custom');
                  setCustomModal(false);
                }}
              >
                <Text style={[typography.bodyBold, { color: colors.white }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {pickerTarget && (
        <DateTimePicker
          value={customRange[pickerTarget]}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handlePickerChange}
        />
      )}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButton: { padding: spacing.xs },
  propertyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  chipScroll: {
  flexGrow: 0,
  height: 44,
  marginBottom: spacing.xs,
},
  chipContent: {
  paddingHorizontal: spacing.md,
  alignItems: 'center',
},

  chip: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: spacing.md,
  paddingVertical: 10,
  minHeight: 36,
  borderRadius: radius.full,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  marginRight: spacing.xs,
  overflow: 'visible',
},
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  statTop: { flexDirection: 'row', alignItems: 'center' },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.sm },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  metric: { width: '33.33%', paddingVertical: spacing.xs, paddingRight: spacing.xs },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  linkRow: { flexDirection: 'row', gap: spacing.sm },
  linkCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 170,
    paddingTop: spacing.sm,
  },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rightPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.full,
    padding: 2,
  },
  segmentItem: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  viewButton: { alignSelf: 'flex-end', marginTop: spacing.sm },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  modalOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
  },
  applyButton: {
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});