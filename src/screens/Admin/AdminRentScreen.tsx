import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
};

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const currentMonthLabel = () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

function RentRow({
  resident,
  roomNumber,
  deduction,
  deductionReason,
  onMarkPaid,
  onDeduction,
}: {
  resident: AdminResident;
  roomNumber: string | undefined;
  deduction: number;
  deductionReason?: string | null;
  onMarkPaid: () => void;
  onDeduction: () => void;
}) {
  const statusStyle = statusColors[resident.rentStatus] ?? statusColors.Pending;
  const net = Math.max(0, resident.monthlyRent - deduction);
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Room {roomNumber ?? '—'}</Text>
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
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2, maxWidth: 140 }]} numberOfLines={1}>
            {deductionReason}
          </Text>
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

      <FlatList
        data={pendingResidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No pending or overdue rent — everyone's paid up! 🎉
          </Text>
        }
        renderItem={({ item }) => (
          <RentRow
            resident={item}
            roomNumber={rooms.find((r) => r.id === item.roomId)?.roomNumber}
            deduction={deductionOf(item)}
            deductionReason={(recordOf.get(item.id) as any)?.deductionReason}
            onMarkPaid={() => handleMarkPaid(item)}
            onDeduction={() => openDeduction(item)}
          />
        )}
      />

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

              <Text style={styles.label}>Reason (optional)</Text>
              <TextInput
                style={styles.input}
                value={dedReason}
                onChangeText={setDedReason}
                placeholder="e.g. Maintenance issue, early payment..."
                placeholderTextColor={colors.textMuted}
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
  left: {},
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