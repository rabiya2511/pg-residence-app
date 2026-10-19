import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';

type View_ = 'rooms' | 'defaulters';
type Bucket = 'All' | 'Over30' | 'From15To30' | 'Recent';

type Due = {
  resident: AdminResident;
  roomId: string;
  roomNumber: string;
  floor: number | null;
  capacity: number | null;
  outstanding: number;
  months: number;
  oldestDue: Date;
  daysOverdue: number;
};

type DueSection = {
  key: string;
  mode: 'room' | 'flat';
  title: string;
  subtitle: string;
  total: number;
  data: Due[];
};

const MONTHS_3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Parses "25 Sep 2026" and "Sep 25, 2026".
function parseDue(str: string | null | undefined): Date | null {
  if (!str) return null;
  const s = str.trim();
  const a = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
  if (a) {
    const m = MONTHS_3.indexOf(a[2].toLowerCase());
    return m === -1 ? null : new Date(Number(a[3]), m, Number(a[1]));
  }
  const b = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (b) {
    const m = MONTHS_3.indexOf(b[1].toLowerCase());
    return m === -1 ? null : new Date(Number(b[3]), m, Number(b[2]));
  }
  return null;
}

const money = (n: number) => `₹${n.toLocaleString()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

const inBucket = (days: number, bucket: Bucket) =>
  bucket === 'All' ? true : bucket === 'Over30' ? days > 30 : bucket === 'From15To30' ? days >= 15 && days <= 30 : days < 15;

export default function AdminPendingDuesScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, properties, paymentRecords, markRentPaid } = useAdmin();

  const [view, setView] = useState<View_>('rooms');
  const [bucket, setBucket] = useState<Bucket>('All');
  const [search, setSearch] = useState('');
  const [whatsappVisible, setWhatsappVisible] = useState(false);

  // One entry per resident who still owes rent (same rule as the dashboard's Pending Rent count).
  const dues = useMemo<Due[]>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return residents
      .filter((r) => r.rentStatus !== 'Paid')
      .map((r) => {
        const room = rooms.find((rm) => rm.id === r.roomId);
        const unpaid = paymentRecords.filter((p) => p.residentId === r.id && p.status !== 'Paid');
        const fallbackDue = new Date(now.getFullYear(), now.getMonth(), r.rentDueDay || 5);

        let outstanding = r.monthlyRent;
        let months = 1;
        let oldestDue = fallbackDue;
        if (unpaid.length > 0) {
          outstanding = unpaid.reduce((sum, p) => sum + p.amount, 0);
          months = unpaid.length;
          const dates = unpaid.map((p) => parseDue(p.dueDate)).filter((d): d is Date => !!d);
          if (dates.length > 0) oldestDue = new Date(Math.min(...dates.map((d) => d.getTime())));
        }

        return {
          resident: r,
          roomId: room ? room.id : 'unassigned',
          roomNumber: room ? room.roomNumber : '—',
          floor: room ? room.floor : null,
          capacity: room ? room.capacity : null,
          outstanding,
          months,
          oldestDue,
          daysOverdue: Math.max(0, Math.floor((today - oldestDue.getTime()) / DAY_MS)),
        };
      });
  }, [residents, rooms, paymentRecords]);

  const totalOutstanding = dues.reduce((sum, d) => sum + d.outstanding, 0);
  const roomsAffected = new Set(dues.map((d) => d.roomId)).size;
  const critical = dues.filter((d) => d.daysOverdue > 60).length;

  const counts = {
    All: dues.length,
    Over30: dues.filter((d) => inBucket(d.daysOverdue, 'Over30')).length,
    From15To30: dues.filter((d) => inBucket(d.daysOverdue, 'From15To30')).length,
    Recent: dues.filter((d) => inBucket(d.daysOverdue, 'Recent')).length,
  };

  // Search + day filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dues.filter(
      (d) =>
        inBucket(d.daysOverdue, bucket) &&
        (!q ||
          d.resident.name.toLowerCase().includes(q) ||
          d.roomNumber.toLowerCase().includes(q) ||
          (d.resident.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    );
  }, [dues, bucket, search]);

  const sections = useMemo<DueSection[]>(() => {
    if (filtered.length === 0) return [];

    if (view === 'defaulters') {
      const sorted = [...filtered].sort((a, b) => b.daysOverdue - a.daysOverdue);
      return [
        {
          key: 'all',
          mode: 'flat',
          title: '',
          subtitle: '',
          total: sorted.reduce((s, d) => s + d.outstanding, 0),
          data: sorted,
        },
      ];
    }

    const groups = new Map<string, DueSection>();
    filtered.forEach((d) => {
      if (!groups.has(d.roomId)) {
        groups.set(d.roomId, {
          key: d.roomId,
          mode: 'room',
          title: d.roomId === 'unassigned' ? 'Unassigned' : `Room ${d.roomNumber}`,
          subtitle: d.floor != null ? `Floor ${d.floor} · ${d.capacity} Sharing` : 'No room allocated',
          total: 0,
          data: [],
        });
      }
      const g = groups.get(d.roomId)!;
      g.data.push(d);
      g.total += d.outstanding;
    });
    return Array.from(groups.values())
      .map((g) => ({ ...g, data: g.data.sort((a, b) => b.daysOverdue - a.daysOverdue) }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  }, [filtered, view]);

  const propertyNameOf = (r: AdminResident) => properties.find((p) => p.id === r.propertyId)?.name ?? 'your PG';

  const reminderMessage = (d: Due) =>
    `Hi ${d.resident.name}, your rent of ${money(d.outstanding)}${d.roomNumber !== '—' ? ` for Room ${d.roomNumber}` : ''} is pending${
      d.daysOverdue > 0 ? ` (${d.daysOverdue} days overdue)` : ''
    }. Please pay at the earliest. — ${propertyNameOf(d.resident)}`;

  const reminderRecipients: WhatsAppRecipient[] = filtered.map((d) => ({
    id: d.resident.id,
    name: d.resident.name,
    message: reminderMessage(d),
  }));

  const callResident = (phone: string) => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {});

  const whatsappResident = (d: Due) => {
    let digits = (d.resident.phone ?? '').replace(/[^\d]/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(reminderMessage(d))}`).catch(() => {});
  };

  const handleMarkPaid = (d: Due) =>
    Alert.alert(
      'Mark Rent as Paid',
      `Confirm this month's rent from ${d.resident.name}${d.roomNumber !== '—' ? ` (Room ${d.roomNumber})` : ''} has been received?` +
        (d.months > 1 ? `\n\nNote: this only clears the current month. ${d.months} months are pending in total.` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => markRentPaid(d.resident.id) },
      ]
    );

  const daysColor = (days: number) => (days > 60 ? colors.error : days > 30 ? colors.warning : colors.textMuted);

  const BUCKETS: { key: Bucket; label: string }[] = [
    { key: 'All', label: 'All Dues' },
    { key: 'Over30', label: '>30 Days' },
    { key: 'From15To30', label: '15-30 Days' },
    { key: 'Recent', label: 'Recent' },
  ];

  const header = (
    <View>
      <View style={styles.overviewCard}>
        <View style={styles.overviewTop}>
          <View style={styles.overviewIcon}>
            <Ionicons name="receipt-outline" size={20} color={colors.warning} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>Outstanding Dues Overview</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Active payment tracking</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: critical > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
            <Text style={[typography.caption, { color: critical > 0 ? colors.error : colors.success, fontWeight: '700' }]}>
              {dues.length} Defaulters
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Total Outstanding</Text>
            <Text style={[typography.heading2, { color: dues.length ? colors.error : colors.success }]}>{money(totalOutstanding)}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {roomsAffected} {roomsAffected === 1 ? 'room' : 'rooms'} affected
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Critical (&gt;60d)</Text>
            <Text style={[typography.heading2, { color: critical ? colors.error : colors.success }]}>{critical} Defaulters</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{critical ? 'Needs follow-up' : 'All accounts normal'}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.remindButton, filtered.length === 0 && { opacity: 0.5 }]}
            activeOpacity={0.85}
            disabled={filtered.length === 0}
            onPress={() => setWhatsappVisible(true)}
          >
            <Ionicons name="notifications-outline" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
              Remind All ({filtered.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reportButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminReportDetail', { reportId: 'pending-dues', title: 'Pending Dues' })}
          >
            <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.viewSwitch}>
        <TouchableOpacity style={[styles.viewTab, view === 'rooms' && styles.viewTabActive]} onPress={() => setView('rooms')}>
          <Ionicons name="grid-outline" size={15} color={view === 'rooms' ? colors.white : colors.text} />
          <Text style={[typography.caption, { color: view === 'rooms' ? colors.white : colors.text, fontWeight: '700', marginLeft: 6 }]}>
            Room-wise View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewTab, view === 'defaulters' && styles.viewTabActive]} onPress={() => setView('defaulters')}>
          <Ionicons name="list-outline" size={15} color={view === 'defaulters' ? colors.white : colors.text} />
          <Text style={[typography.caption, { color: view === 'defaulters' ? colors.white : colors.text, fontWeight: '700', marginLeft: 6 }]}>
            All Defaulters ({dues.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, room or phone..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.chipRow}>
        {BUCKETS.map((b) => {
          const on = bucket === b.key;
          return (
            <TouchableOpacity key={b.key} style={[styles.chip, on && styles.chipActive]} onPress={() => setBucket(b.key)}>
              <Text style={[styles.chipText, { color: on ? colors.white : colors.text }]}>{b.label}</Text>
              <View style={[styles.chipCount, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.background }]}>
                <Text style={[styles.chipCountText, { color: on ? colors.white : colors.textMuted }]}>{counts[b.key]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderDue = (d: Due, flat: boolean) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {flat && (
          <View style={styles.roomBadge}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Room {d.roomNumber}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{d.resident.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{d.resident.phone}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.heading3, { color: colors.error }]}>{money(d.outstanding)}</Text>
          <Text style={[typography.caption, { color: daysColor(d.daysOverdue), fontWeight: '700' }]}>
            {d.daysOverdue > 0 ? `${d.daysOverdue} days overdue` : 'Due soon'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
          {d.months} {d.months === 1 ? 'month' : 'months'} pending · since{' '}
          {d.oldestDue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => callResident(d.resident.phone ?? '')}>
          <Ionicons name="call-outline" size={17} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => whatsappResident(d)}>
          <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.paidBtn} onPress={() => handleMarkPaid(d)}>
          <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Mark Paid</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading2, { color: colors.text, flex: 1 }]}>Pending Dues</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.resident.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          dues.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.sm }]}>All Dues Cleared!</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
                There are no pending dues across all registered rooms.
              </Text>
            </View>
          ) : (
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              No dues match this search or filter.
            </Text>
          )
        }
        renderSectionHeader={({ section }) =>
          section.mode === 'room' ? (
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.heading3, { color: colors.text }]}>{section.title}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{section.subtitle}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.bodyBold, { color: colors.error }]}>{money(section.total)}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {section.data.length} {section.data.length === 1 ? 'resident' : 'residents'}
                </Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item, section }) => renderDue(item, section.mode === 'flat')}
      />

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="Rent Reminders"
        recipients={reminderRecipients}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  backButton: { padding: spacing.xs, marginRight: spacing.xs },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  overviewCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.xs },
  overviewTop: { flexDirection: 'row', alignItems: 'center' },
  overviewIcon: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  remindButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warning, borderRadius: radius.md, paddingVertical: spacing.sm },
  reportButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm },
  viewSwitch: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 4, marginTop: spacing.md },
  viewTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  viewTabActive: { backgroundColor: colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipCount: { marginLeft: 6, minWidth: 20, paddingHorizontal: 5, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontSize: 11, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  roomBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, marginRight: spacing.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs },
  iconBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  paidBtn: { backgroundColor: colors.success, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: 34, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, marginTop: spacing.md },
});