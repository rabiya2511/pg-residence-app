import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import {
  Schedule,
  Frequency,
  HistoryItem,
  subscribeSchedules,
  subscribeHistory,
  createSchedule,
  updateSchedule,
  setScheduleEnabled,
  markScheduleSent,
  removeSchedule,
} from '../../services/reportsService';

// Every id below is handled by AdminReportDetailScreen, so tapping any row opens real data.
type Category = 'Resident' | 'Room' | 'Financial' | 'Complaint';
const CATEGORIES: Category[] = ['Resident', 'Room', 'Financial', 'Complaint'];

interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: Category;
}

// Exported so the dashboard's Reports tile can show REPORTS.length.
export const REPORTS: ReportDef[] = [
  { id: 'resident-master', category: 'Resident', title: 'Resident Master Report', description: 'Complete directory of all registered residents with room, contact & KYC' },
  { id: 'active-residents', category: 'Resident', title: 'Active Residents', description: 'List of currently active paying tenants living on premise' },
  { id: 'new-residents', category: 'Resident', title: 'New Residents', description: 'Recently joined residents within the selected timeframe' },
  { id: 'checked-out-residents', category: 'Resident', title: 'Checked-Out Residents', description: 'Historical residents who have completed checkout and settled dues' },
  { id: 'notice-period-residents', category: 'Resident', title: 'Notice Period Residents', description: 'Residents currently serving exit notice with upcoming checkout dates' },
  { id: 'pre-bookings', category: 'Resident', title: 'Pre-Bookings', description: 'Upcoming prospective admissions and reserved bed slots' },
  { id: 'daily-short-stay', category: 'Resident', title: 'Daily/Short-Stay Residents', description: 'Temporary guest stays with check-in, check-out and per-day tariffs' },
  { id: 'room-occupancy', category: 'Room', title: 'Room Occupancy', description: 'Occupied beds against capacity for every room' },
  { id: 'vacant-rooms', category: 'Room', title: 'Vacant Rooms', description: 'Rooms that still have beds available for allocation' },
  { id: 'full-rooms', category: 'Room', title: 'Full Rooms', description: 'Rooms with every bed occupied' },
  { id: 'rent-collection', category: 'Financial', title: 'Rent Collection', description: 'Rent payments received in the selected period' },
  { id: 'pending-dues', category: 'Financial', title: 'Pending Dues', description: 'Residents with pending or overdue rent' },
  { id: 'revenue-summary', category: 'Financial', title: 'Revenue Summary', description: 'Resident rent plus day-guest income' },
  { id: 'open-complaints', category: 'Complaint', title: 'Open Complaints', description: 'Complaints that are still open and waiting for action' },
  { id: 'in-progress-complaints', category: 'Complaint', title: 'In Progress Complaints', description: 'Complaints moved to In Progress within the selected period' },
  { id: 'resolved-complaints', category: 'Complaint', title: 'Resolved Complaints', description: 'Complaints resolved within the selected period' },
  { id: 'all-complaints', category: 'Complaint', title: 'All Complaints', description: 'Every complaint with category and status' },
];

// History row look, by report category.
const CATEGORY_STYLE: Record<Category, { icon: string; color: string }> = {
  Resident: { icon: 'people-outline', color: colors.primary },
  Room: { icon: 'grid-outline', color: colors.success },
  Financial: { icon: 'document-text-outline', color: colors.error },
  Complaint: { icon: 'chatbox-ellipses-outline', color: colors.warning },
};

// ───────────────────────── Scheduled reports ─────────────────────────
const FREQUENCIES: Frequency[] = ['Daily', 'Weekly', 'Monthly'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28];
const RANGE_OPTIONS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'This Year', 'All Records'];

const pad = (n: number) => String(n).padStart(2, '0');

function formatTime(h: number, m: number): string {
  const hr12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(hr12)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

function describeSchedule(s: Schedule): string {
  const t = formatTime(s.hour, s.minute);
  if (s.frequency === 'Daily') return `Daily · ${t}`;
  if (s.frequency === 'Weekly') return `Weekly · ${WEEKDAYS[s.weekday]} · ${t}`;
  return `Monthly · day ${s.monthDay} · ${t}`;
}

function nextRunDate(s: Schedule): Date {
  const now = new Date();
  const at = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.hour, s.minute, 0, 0);

  if (s.frequency === 'Daily') {
    let c = at(now);
    if (c <= now) c = at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    return c;
  }
  if (s.frequency === 'Weekly') {
    const add = (s.weekday - now.getDay() + 7) % 7;
    let c = at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + add));
    if (c <= now) c = at(new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7));
    return c;
  }
  let c = at(new Date(now.getFullYear(), now.getMonth(), s.monthDay));
  if (c <= now) c = at(new Date(now.getFullYear(), now.getMonth() + 1, s.monthDay));
  return c;
}

function formatNextRun(s: Schedule): string {
  const d = nextRunDate(s);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${day}, ${formatTime(d.getHours(), d.getMinutes())}`;
}

const formatStamp = (d: Date | null) =>
  d
    ? `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${formatTime(d.getHours(), d.getMinutes())}`
    : '—';

export default function AdminReportsScreen() {
  const navigation = useNavigation<any>();
  const { properties } = useAdmin();

  const propertyId: string | undefined = properties[0]?.id;
  const propertyName = properties[0]?.name ?? 'My PG';

  const [view, setView] = useState<'list' | 'history' | 'scheduled'>('list');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | Category>('All');

  // ---- Firestore-backed state ----
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingSched, setLoadingSched] = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- schedule form state ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [fReportId, setFReportId] = useState('');
  const [fFreq, setFFreq] = useState<Frequency>('Weekly');
  const [fWeekday, setFWeekday] = useState(1);
  const [fMonthDay, setFMonthDay] = useState(1);
  const [fTime, setFTime] = useState(new Date(2000, 0, 1, 9, 0));
  const [fRange, setFRange] = useState('This Month');

  // Live subscriptions, re-created when the property changes.
  useEffect(() => {
    if (!propertyId) {
      setSchedules([]);
      setHistory([]);
      setLoadingSched(false);
      setLoadingHist(false);
      return;
    }
    setLoadingSched(true);
    setLoadingHist(true);
    const onErr = (e: Error) => {
      console.warn('Reports Firestore error', e);
      setLoadingSched(false);
      setLoadingHist(false);
    };
    try {
      const unsubS = subscribeSchedules(propertyId, (l) => { setSchedules(l); setLoadingSched(false); }, onErr);
      const unsubH = subscribeHistory(propertyId, (l) => { setHistory(l); setLoadingHist(false); }, onErr);
      return () => {
        unsubS();
        unsubH();
      };
    } catch (e: any) {
      // e.g. "Not signed in"
      onErr(e);
    }
  }, [propertyId]);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORIES.map((c) => ({
      category: c,
      items: REPORTS.filter(
        (r) =>
          r.category === c &&
          (category === 'All' || category === c) &&
          (!q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
      ),
    })).filter((s) => s.items.length > 0);
  }, [search, category]);

  const openReport = (r: ReportDef) => navigation.navigate('AdminReportDetail', { reportId: r.id, title: r.title });
  const goBack = () => (view === 'list' ? navigation.goBack() : setView('list'));
  const screenTitle = view === 'list' ? 'Reports & Audits' : view === 'history' ? 'Report History & Audit' : 'Scheduled Reports';

  // ---- schedule actions ----
  const openNewSchedule = () => {
    setEditing(null);
    setFReportId('');
    setFFreq('Weekly');
    setFWeekday(1);
    setFMonthDay(1);
    setFTime(new Date(2000, 0, 1, 9, 0));
    setFRange('This Month');
    setReportPickerOpen(false);
    setFormOpen(true);
  };

  const openEditSchedule = (s: Schedule) => {
    setEditing(s);
    setFReportId(s.reportId);
    setFFreq(s.frequency);
    setFWeekday(s.weekday);
    setFMonthDay(s.monthDay);
    setFTime(new Date(2000, 0, 1, s.hour, s.minute));
    setFRange(s.range);
    setReportPickerOpen(false);
    setFormOpen(true);
  };

  const saveSchedule = async () => {
    if (!propertyId) {
      Alert.alert('No Property', 'Add a property before scheduling reports.');
      return;
    }
    if (!fReportId) {
      Alert.alert('Select a Report', 'Choose which report you want to schedule.');
      return;
    }
    const input = {
      reportId: fReportId,
      frequency: fFreq,
      weekday: fWeekday,
      monthDay: fMonthDay,
      hour: fTime.getHours(),
      minute: fTime.getMinutes(),
      range: fRange,
    };
    try {
      setSaving(true);
      if (editing) await updateSchedule(editing.id, propertyId, input);
      else await createSchedule(propertyId, input);
      setShowTimePicker(false);
      setFormOpen(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSchedule = async (id: string, value: boolean) => {
    try {
      await setScheduleEnabled(id, value);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    }
  };

  const deleteSchedule = (s: Schedule) => {
    const title = REPORTS.find((r) => r.id === s.reportId)?.title ?? 'this schedule';
    Alert.alert('Delete Schedule', `Remove the schedule for ${title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeSchedule(s.id);
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  // Opens the report with the schedule's date range and generates the PDF straight away.
  // The detail screen records the export in Audit History, so it is not logged here.
  const sendNow = async (s: Schedule) => {
    const r = REPORTS.find((x) => x.id === s.reportId);
    if (!r) return;
    try {
      await markScheduleSent(s.id);
    } catch (e: any) {
      Alert.alert('Could not record this send', e?.message ?? 'The report will still open.');
    }
    navigation.navigate('AdminReportDetail', { reportId: r.id, title: r.title, range: s.range, autoExport: true });
  };

  const activeSchedules = schedules.filter((s) => s.enabled).length;
  const fReportTitle = REPORTS.find((r) => r.id === fReportId)?.title;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>{screenTitle}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.propertyCard}>
        <View style={styles.propertyIconWrap}>
          <Ionicons name="business" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{propertyName}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Reports filtered to this property</Text>
        </View>
      </View>

      {/* ───────────── LIST ───────────── */}
      {view === 'list' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickCard} onPress={() => setView('scheduled')}>
              <Ionicons name="alarm-outline" size={22} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>Scheduled</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {schedules.length > 0 ? `${activeSchedules} active` : 'Daily / Weekly dispatch'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => setView('history')}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>Audit History</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {history.length > 0 ? `${history.length} generated` : 'Generated files'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${REPORTS.length} business reports...`}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {(['All', ...CATEGORIES] as const).map((c) => {
              const count = c === 'All' ? REPORTS.length : REPORTS.filter((r) => r.category === c).length;
              const on = category === c;
              return (
                <TouchableOpacity key={c} style={[styles.chip, on && styles.chipActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.chipText, { color: on ? colors.white : colors.text }]}>
                    {c === 'All' ? 'All Reports' : `${c} Reports`} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {sections.length === 0 && (
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              No reports match "{search}". Try a shorter search.
            </Text>
          )}

          {sections.map((sec) => (
            <View key={sec.category} style={styles.groupCard}>
              <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.xs }]}>
                {sec.category} Reports ({sec.items.length})
              </Text>
              {sec.items.map((r, i) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.reportRow, i > 0 && styles.reportRowDivider]}
                  activeOpacity={0.8}
                  onPress={() => openReport(r)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{r.title}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{r.description}</Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>Preview & Export</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ───────────── SCHEDULED ───────────── */}
      {view === 'scheduled' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <Text style={[typography.caption, { color: colors.text, flex: 1, marginLeft: spacing.xs }]}>
              Schedules are saved to your account. Each one shows when its report is due. Tap "Send now" to generate the
              PDF and share it by WhatsApp, email or Drive. Fully automatic sending needs a server (e.g. Cloud Functions)
              and isn't available yet.
            </Text>
          </View>

          <TouchableOpacity style={styles.newButton} activeOpacity={0.85} onPress={openNewSchedule}>
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>New Schedule</Text>
          </TouchableOpacity>

          {loadingSched && <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />}

          {!loadingSched && schedules.length === 0 && (
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              No schedules yet. Tap "New Schedule" to add one.
            </Text>
          )}

          {schedules.map((s) => {
            const r = REPORTS.find((x) => x.id === s.reportId);
            return (
              <View key={s.id} style={[styles.schedCard, !s.enabled && { opacity: 0.6 }]}>
                <View style={styles.schedTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{r?.title ?? 'Report'}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{describeSchedule(s)}</Text>
                  </View>
                  <Switch
                    value={s.enabled}
                    onValueChange={(v) => toggleSchedule(s.id, v)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={colors.white}
                  />
                </View>

                <View style={styles.schedMeta}>
                  <View style={styles.tag}>
                    <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>{s.range}</Text>
                  </View>
                  <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                    {s.enabled ? `Next due: ${formatNextRun(s)}` : 'Paused'}
                  </Text>
                </View>
                {!!s.lastSent && (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Last sent: {formatStamp(s.lastSent)}</Text>
                )}

                <View style={styles.schedActions}>
                  <TouchableOpacity style={styles.sendBtn} activeOpacity={0.85} onPress={() => sendNow(s)}>
                    <Ionicons name="paper-plane-outline" size={16} color={colors.white} />
                    <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>Send now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => openEditSchedule(s)}>
                    <Ionicons name="create-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => deleteSchedule(s)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ───────────── HISTORY ───────────── */}
      {view === 'history' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            Track all generated PDF, Excel, and CSV business records
          </Text>

          {loadingHist && <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />}

          {!loadingHist && history.length === 0 && (
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              No reports generated yet.
            </Text>
          )}

          {history.map((h) => {
            const cat = REPORTS.find((r) => r.id === h.reportId)?.category;
            const look = cat ? CATEGORY_STYLE[cat] : { icon: 'document-outline', color: colors.primary };
            return (
              <View key={h.id} style={styles.historyCard}>
                <View style={[styles.historyIcon, { backgroundColor: `${look.color}20` }]}>
                  <Ionicons name={look.icon as any} size={22} color={look.color} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{h.title}</Text>
                  <Text style={[typography.caption, { color: colors.warning, fontWeight: '600', marginTop: 2 }]}>{propertyName} · {h.scope}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    Generated: {formatStamp(h.generatedAt)} · {h.format}{h.sizeKb != null ? ` · ${h.sizeKb} KB` : ''}
                  </Text>
                </View>
                <TouchableOpacity hitSlop={10} onPress={() => Alert.alert(h.title, 'Sharing the saved file is not wired up yet.')}>
                  <Ionicons name="share-social-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ───────────── New / edit schedule sheet ───────────── */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {reportPickerOpen ? (
              <>
                <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>Choose a report</Text>
                <ScrollView style={{ maxHeight: 380 }}>
                  {REPORTS.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.pickRow}
                      onPress={() => {
                        setFReportId(r.id);
                        setReportPickerOpen(false);
                      }}
                    >
                      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{r.title}</Text>
                      {fReportId === r.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={[styles.cancelBtn, { marginTop: spacing.sm }]} onPress={() => setReportPickerOpen(false)}>
                  <Text style={[typography.button, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
                  {editing ? 'Edit Schedule' : 'New Schedule'}
                </Text>

                <Text style={styles.formLabel}>Report</Text>
                <TouchableOpacity style={styles.selectBox} onPress={() => setReportPickerOpen(true)}>
                  <Text style={[typography.body, { color: fReportTitle ? colors.text : colors.textMuted, flex: 1 }]}>
                    {fReportTitle ?? 'Select a report'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <Text style={styles.formLabel}>Repeat</Text>
                <View style={styles.wrapRow}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity key={f} style={[styles.chip, fFreq === f && styles.chipActive]} onPress={() => setFFreq(f)}>
                      <Text style={[styles.chipText, { color: fFreq === f ? colors.white : colors.text }]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {fFreq === 'Weekly' && (
                  <>
                    <Text style={styles.formLabel}>Day of week</Text>
                    <View style={styles.wrapRow}>
                      {WEEKDAYS.map((d, i) => (
                        <TouchableOpacity key={d} style={[styles.chip, fWeekday === i && styles.chipActive]} onPress={() => setFWeekday(i)}>
                          <Text style={[styles.chipText, { color: fWeekday === i ? colors.white : colors.text }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {fFreq === 'Monthly' && (
                  <>
                    <Text style={styles.formLabel}>Day of month</Text>
                    <View style={styles.wrapRow}>
                      {MONTH_DAYS.map((d) => (
                        <TouchableOpacity key={d} style={[styles.chip, fMonthDay === d && styles.chipActive]} onPress={() => setFMonthDay(d)}>
                          <Text style={[styles.chipText, { color: fMonthDay === d ? colors.white : colors.text }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.formLabel}>Time</Text>
                <TouchableOpacity style={styles.selectBox} onPress={() => setShowTimePicker(true)}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                    {formatTime(fTime.getHours(), fTime.getMinutes())}
                  </Text>
                  <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={fTime}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_e, d) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (d) setFTime(d);
                    }}
                  />
                )}

                <Text style={styles.formLabel}>Data window</Text>
                <View style={styles.wrapRow}>
                  {RANGE_OPTIONS.map((r) => (
                    <TouchableOpacity key={r} style={[styles.chip, fRange === r && styles.chipActive]} onPress={() => setFRange(r)}>
                      <Text style={[styles.chipText, { color: fRange === r ? colors.white : colors.text }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formFooter}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    disabled={saving}
                    onPress={() => {
                      setShowTimePicker(false);
                      setFormOpen(false);
                    }}
                  >
                    <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving} onPress={saveSchedule}>
                    {saving ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={[typography.button, { color: colors.white }]}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs },
  propertyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  propertyIconWrap: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  quickCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  chipRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', includeFontPadding: false, textAlignVertical: 'center' },
  groupCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  reportRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  tag: { backgroundColor: '#FEF3C7', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  historyIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },

  // scheduled
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  newButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  schedCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  schedTop: { flexDirection: 'row', alignItems: 'center' },
  schedMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  schedActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, maxHeight: '88%' },
  formLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  selectBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  formFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingVertical: spacing.sm },
  saveBtn: { flex: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: spacing.sm },
});