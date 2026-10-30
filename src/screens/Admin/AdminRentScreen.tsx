import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';
import ResidentAvatar from '../../components/common/ResidentAvatar';
import { formatPhoneDisplay } from '../../utils/phone';

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
};

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
type ViewMode = 'list' | 'room';
type StatusFilter = 'pending' | 'paid' | 'all';

const currentMonthLabel = () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

function RentRow({
  resident,
  roomNumber,
  deduction,
  deductionReason,
  hideRoom,
  onMarkPaid,
  onDeduction,
}: {
  resident: AdminResident;
  roomNumber: string | undefined;
  deduction: number;
  deductionReason?: string | null;
  hideRoom?: boolean;
  onMarkPaid: () => void;
  onDeduction: () => void;
}) {
  const statusStyle = statusColors[resident.rentStatus] ?? statusColors.Pending;
  const net = Math.max(0, resident.monthlyRent - deduction);
  return (
    <View style={styles.card}>
      <ResidentAvatar uri={resident.profileImageUri} name={resident.name} size={40} />
      <View style={styles.left}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
        {!!resident.phone && (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{formatPhoneDisplay(resident.phone)}</Text>
        )}
        {!hideRoom && (
          <Text style={[typography.caption, { color: colors.textMuted }]}>Room {roomNumber ?? '—'}</Text>
        )}
        <TouchableOpacity
          style={[styles.deductionBtn, deduction > 0 && styles.deductionBtnOn]}
          activeOpacity={0.8}
          onPress={onDeduction}
        >
          <Ionicons
            name={deduction > 0 ? 'create-outline' : 'remove-circle-outline'}
            size={14}
            color={deduction > 0 ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              typography.caption,
              { color: deduction > 0 ? colors.primary : colors.textMuted, fontWeight: '700', marginLeft: 4 },
            ]}
          >
            {deduction > 0 ? `Deduction ${money(deduction)}` : 'Add Deduction'}
          </Text>
        </TouchableOpacity>
        {!!deductionReason && deduction > 0 && (
          <View style={styles.noteRow}>
            <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
            <Text style={[typography.caption, styles.noteText]} numberOfLines={2}>
              {deductionReason}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[typography.heading3, { color: colors.text }]}>{money(net)}</Text>
        {deduction > 0 && (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            <Text style={{ textDecorationLine: 'line-through' }}>{money(resident.monthlyRent)}</Text>
            {`  −${money(deduction)}`}
          </Text>
        )}
        {resident.rentStatus === 'Paid' ? (
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[typography.caption, { color: statusStyle.text }]}>Paid</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.badge, { backgroundColor: statusStyle.bg }]}
            onPress={onMarkPaid}
            activeOpacity={0.7}
          >
            <Text style={[typography.caption, { color: statusStyle.text }]}>
              {resident.rentStatus} · Tap to Mark Paid
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AdminRentScreen() {
  const { residents, markRentPaid, setRentDeduction, rooms, paymentRecords, properties } = useAdmin();
  const [whatsappVisible, setWhatsappVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');

  // Deduction dialog
  const [dedTarget, setDedTarget] = useState<AdminResident | null>(null);
  const [dedAmount, setDedAmount] = useState('');
  const [dedReason, setDedReason] = useState('');

  // This month's rent record per resident (holds the deduction, and the amount actually paid).
  const recordOf = useMemo(() => {
    const label = currentMonthLabel();
    const map = new Map<string, any>();
    paymentRecords.forEach((p: any) => {
      if (p.month === label) map.set(p.residentId, p);
    });
    return map;
  }, [paymentRecords]);

  const deductionOf = (r: AdminResident) => Number((recordOf.get(r.id) as any)?.deduction ?? 0) || 0;
  const netRentOf = (r: AdminResident) => Math.max(0, r.monthlyRent - deductionOf(r));

  const paidResidents = residents.filter((r) => r.rentStatus === 'Paid');
  const totalCollected = paidResidents.reduce((sum, r) => {
    const rec = recordOf.get(r.id);
    return sum + (rec && rec.status === 'Paid' ? Number(rec.amount) || 0 : r.monthlyRent);
  }, 0);
  const pendingResidents = residents.filter((r) => r.rentStatus !== 'Paid');
  const totalPending = pendingResidents.reduce((sum, r) => sum + netRentOf(r), 0);

  const openDeduction = (r: AdminResident) => {
    const cur = deductionOf(r);
    setDedTarget(r);
    setDedAmount(cur > 0 ? String(cur) : '');
    setDedReason(((recordOf.get(r.id) as any)?.deductionReason as string) ?? '');
  };

  const closeDeduction = () => setDedTarget(null);

  const saveDeduction = (clear = false) => {
    if (!dedTarget) return;
    const value = clear ? 0 : Number(dedAmount);
    if (!clear) {
      if (isNaN(value) || value <= 0) {
        Alert.alert('Enter an Amount', 'Type the deduction amount, for example 500.');
        return;
      }
      if (!dedReason.trim()) {
        Alert.alert('Add a Note', 'Please write why this amount is being deducted.');
        return;
      }
      if (value > dedTarget.monthlyRent) {
        Alert.alert('Too Large', `The deduction cannot be more than the rent (${money(dedTarget.monthlyRent)}).`);
        return;
      }
    }
    setRentDeduction(dedTarget.id, value, clear ? '' : dedReason);
    closeDeduction();
  };

  const handleMarkPaid = (resident: AdminResident) => {
    const ded = deductionOf(resident);
    Alert.alert(
      'Mark Rent as Paid',
      `Confirm ${money(netRentOf(resident))} received from ${resident.name}?` +
        (ded > 0 ? `\n\n(Rent ${money(resident.monthlyRent)} − deduction ${money(ded)})` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => markRentPaid(resident.id) },
      ]
    );
  };

  const reminderRecipients: WhatsAppRecipient[] = pendingResidents.map((r) => {
    const pg = properties.find((p) => p.id === r.propertyId)?.name ?? 'your PG';
    const ded = deductionOf(r);
       return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      profileImageUri: r.profileImageUri,
      message:
        `Hi ${r.name}, your rent of ${money(netRentOf(r))}` +
        (ded > 0 ? ` (after a deduction of ${money(ded)})` : '') +
        ` is still ${r.rentStatus.toLowerCase()}. Please pay at the earliest. — ${pg}`,
    };
  });

  // What the list / room views show (status filter + search).
  const visibleResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents
      .filter((r) =>
        statusFilter === 'all' ? true : statusFilter === 'paid' ? r.rentStatus === 'Paid' : r.rentStatus !== 'Paid'
      )
      .filter((r) => {
        if (!q) return true;
        const room = rooms.find((rm) => rm.id === r.roomId)?.roomNumber ?? '';
        return (
          r.name.toLowerCase().includes(q) ||
          (r.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
          room.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [residents, rooms, statusFilter, search]);

  const roomSections = useMemo(() => {
    const map = new Map<string, AdminResident[]>();
    visibleResidents.forEach((r) => {
      const list = map.get(r.roomId) ?? [];
      list.push(r);
      map.set(r.roomId, list);
    });
    return Array.from(map.entries())
      .map(([roomId, data]) => ({ room: rooms.find((rm) => rm.id === roomId), roomId, data }))
      .sort((a, b) => {
        const fa = a.room?.floor ?? 999;
        const fb = b.room?.floor ?? 999;
        return fa - fb || (a.room?.roomNumber ?? '').localeCompare(b.room?.roomNumber ?? '', undefined, { numeric: true });
      });
  }, [visibleResidents, rooms]);

  const filterCounts = {
    pending: residents.filter((r) => r.rentStatus !== 'Paid').length,
    paid: residents.filter((r) => r.rentStatus === 'Paid').length,
    all: residents.length,
  };

  const renderRow = (item: AdminResident, hideRoom?: boolean) => (
    <RentRow
      resident={item}
      roomNumber={rooms.find((r) => r.id === item.roomId)?.roomNumber}
      deduction={deductionOf(item)}
      deductionReason={(recordOf.get(item.id) as any)?.deductionReason}
      hideRoom={hideRoom}
      onMarkPaid={() => handleMarkPaid(item)}
      onDeduction={() => openDeduction(item)}
    />
  );

  const emptyText = (
    <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
      {residents.length === 0
        ? 'No residents yet.'
        : search.trim()
        ? 'No residents match your search.'
        : statusFilter === 'pending'
        ? "No pending or overdue rent — everyone's paid up! 🎉"
        : 'No residents found.'}
    </Text>
  );

  const previewNet = dedTarget ? Math.max(0, dedTarget.monthlyRent - (Number(dedAmount) || 0)) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.heading2, { color: colors.text }]}>Rent Overview</Text>
        {pendingResidents.length > 0 && (
          <TouchableOpacity style={styles.reminderButton} activeOpacity={0.85} onPress={() => setWhatsappVisible(true)}>
            <Ionicons name="logo-whatsapp" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, marginLeft: 6 }]}>
              Send WhatsApp Reminders ({pendingResidents.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Collected</Text>
          <Text style={[typography.heading3, { color: colors.success }]}>{money(totalCollected)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Pending</Text>
          <Text style={[typography.heading3, { color: colors.error }]}>{money(totalPending)}</Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        {([
          { key: 'list', label: 'List', icon: 'list-outline' },
          { key: 'room', label: 'Room-wise', icon: 'business-outline' },
        ] as const).map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeBtn, viewMode === m.key && styles.modeBtnActive]}
            onPress={() => setViewMode(m.key)}
            activeOpacity={0.85}
          >
            <Ionicons name={m.icon as any} size={15} color={viewMode === m.key ? colors.white : colors.text} />
            <Text style={[typography.caption, { color: viewMode === m.key ? colors.white : colors.text, fontWeight: '700', marginLeft: 4 }]}>
              {m.label}
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
          placeholder="Search by name, phone or room..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.chipRow}>
        {([
          { key: 'pending', label: 'Pending' },
          { key: 'paid', label: 'Paid' },
          { key: 'all', label: 'All' },
        ] as const).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, statusFilter === f.key && styles.chipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[typography.caption, { color: statusFilter === f.key ? colors.white : colors.text, fontWeight: '700' }]}>
              {f.label} ({filterCounts[f.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={visibleResidents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={emptyText}
          renderItem={({ item }) => renderRow(item)}
        />
      ) : (
        <SectionList
          sections={roomSections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={emptyText}
          renderSectionHeader={({ section }) => {
            const pendingInRoom = section.data.filter((r) => r.rentStatus !== 'Paid').length;
            return (
              <View style={styles.roomHeader}>
                <View style={styles.roomIconWrap}>
                  <Ionicons name="bed-outline" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>
                    {section.room ? `Room ${section.room.roomNumber}` : 'No room'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {section.room ? `Floor ${section.room.floor} · ${section.room.capacity} Sharing · ` : ''}
                    {section.data.length} resident{section.data.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {pendingInRoom > 0 && (
                  <View style={styles.roomPendingBadge}>
                    <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                      {pendingInRoom} pending
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
          renderItem={({ item }) => renderRow(item, true)}
        />
      )}

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="Rent Reminders"
        recipients={reminderRecipients}
      />

      {/* Deduction for ONE resident */}
      <Modal visible={!!dedTarget} transparent animationType="fade" onRequestClose={closeDeduction}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>Rent Deduction</Text>
                <TouchableOpacity onPress={closeDeduction} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {dedTarget && (
                <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                  {dedTarget.name} · rent {money(dedTarget.monthlyRent)}. This applies to {currentMonthLabel()} for this
                  resident only.
                </Text>
              )}

              <Text style={styles.label}>Deduction amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={dedAmount}
                onChangeText={(t) => setDedAmount(t.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                placeholder="e.g. 500"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />

              <Text style={styles.label}>Deduction note (why are you deducting?)</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={dedReason}
                onChangeText={setDedReason}
                placeholder="e.g. Maintenance issue, early payment, damaged item..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={200}
              />

              {dedTarget && (
                <View style={styles.previewBox}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Pending rent will show</Text>
                  <Text style={[typography.heading3, { color: colors.error }]}>{money(previewNet)}</Text>
                </View>
              )}

              <View style={styles.footerRow}>
                {dedTarget && deductionOf(dedTarget) > 0 && (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => saveDeduction(true)}>
                    <Text style={[typography.button, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={() => saveDeduction(false)}>
                  <Text style={[typography.button, { color: colors.white }]}>Save Deduction</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  modeRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  chipRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  roomIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  roomPendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  left: { flex: 1, marginLeft: spacing.sm },
  right: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  deductionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4, maxWidth: 170 },
  noteText: { color: colors.textMuted, marginLeft: 4, flexShrink: 1, fontStyle: 'italic' },
  noteInput: { minHeight: 70, textAlignVertical: 'top' },
  deductionBtnOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
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
  previewBox: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  removeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.sm,
  },
  saveBtn: { flex: 1.6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: spacing.sm },
});