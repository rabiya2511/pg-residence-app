import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

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
  { id: 'open-complaints', category: 'Complaint', title: 'Open Complaints', description: 'Complaints that are open or still in progress' },
  { id: 'resolved-complaints', category: 'Complaint', title: 'Resolved Complaints', description: 'Complaints that have been closed' },
  { id: 'all-complaints', category: 'Complaint', title: 'All Complaints', description: 'Every complaint with category and status' },
];

const HISTORY = [
  { id: '1', title: 'Rent Collection', scope: 'This Month (01 Sep - 30 Sep 2026)', when: '10 Sep 2026, 09:30 AM', size: '142 KB', icon: 'document-text-outline', color: colors.error },
  { id: '2', title: 'Room Occupancy', scope: 'All Records', when: '09 Sep 2026, 06:15 PM', size: '88 KB', icon: 'grid-outline', color: colors.success },
  { id: '3', title: 'Pending Dues', scope: 'This Month', when: '08 Sep 2026, 11:00 AM', size: '24 KB', icon: 'calculator-outline', color: colors.primary },
];

export default function AdminReportsScreen() {
  const navigation = useNavigation<any>();
  const { properties } = useAdmin();

  const [view, setView] = useState<'list' | 'history'>('list');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | Category>('All');

  const propertyName = properties[0]?.name ?? 'My PG';

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
  const goBack = () => (view === 'history' ? setView('list') : navigation.goBack());

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>
          {view === 'list' ? 'Reports & Audits' : 'Report History & Audit'}
        </Text>
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

      {view === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => Alert.alert('Scheduled Reports', 'Daily / weekly auto dispatch is not built yet.')}
            >
              <Ionicons name="alarm-outline" size={22} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>Scheduled</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>Daily / Weekly dispatch</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => setView('history')}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>Audit History</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>Generated files</Text>
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
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            Track all generated PDF, Excel, and CSV business records
          </Text>
          {HISTORY.map((h) => (
            <View key={h.id} style={styles.historyCard}>
              <View style={[styles.historyIcon, { backgroundColor: `${h.color}20` }]}>
                <Ionicons name={h.icon as any} size={22} color={h.color} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{h.title}</Text>
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '600', marginTop: 2 }]}>{propertyName} · {h.scope}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Generated: {h.when} · {h.size}</Text>
              </View>
              <TouchableOpacity hitSlop={10} onPress={() => Alert.alert(h.title, 'Sharing the saved file is not wired up yet.')}>
                <Ionicons name="share-social-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
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
});