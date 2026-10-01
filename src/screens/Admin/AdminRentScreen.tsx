import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
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

function RentRow({
  resident,
  roomNumber,
  onMarkPaid,
}: {
  resident: AdminResident;
  roomNumber: string | undefined;
  onMarkPaid: () => void;
}) {
  const statusStyle = statusColors[resident.rentStatus];
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Room {roomNumber ?? '—'}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[typography.heading3, { color: colors.text }]}>
          ₹{resident.monthlyRent}
        </Text>
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
  const { residents, markRentPaid, rooms } = useAdmin();
  const [whatsappVisible, setWhatsappVisible] = useState(false);

  const totalCollected = residents
    .filter((r) => r.rentStatus === 'Paid')
    .reduce((sum, r) => sum + r.monthlyRent, 0);
  const pendingResidents = residents.filter((r) => r.rentStatus !== 'Paid');
  const totalPending = pendingResidents.reduce((sum, r) => sum + r.monthlyRent, 0);

  const handleMarkPaid = (resident: AdminResident) => {
    Alert.alert('Mark Rent as Paid', `Confirm ₹${resident.monthlyRent} received from ${resident.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => markRentPaid(resident.id) },
    ]);
  };

  const reminderRecipients: WhatsAppRecipient[] = pendingResidents.map((r) => ({
    id: r.id,
    name: r.name,
    message: `Hi ${r.name}, your rent of ₹${r.monthlyRent} is still ${r.rentStatus.toLowerCase()}. Please pay at the earliest to avoid late fees. — Lokansh Aditya PG Residency`,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.heading2, { color: colors.text }]}>Rent Overview</Text>
        {pendingResidents.length > 0 && (
          <TouchableOpacity
            style={styles.reminderButton}
            activeOpacity={0.85}
            onPress={() => setWhatsappVisible(true)}
          >
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
          <Text style={[typography.heading3, { color: colors.success }]}>
            ₹{totalCollected.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Pending</Text>
          <Text style={[typography.heading3, { color: colors.error }]}>
            ₹{totalPending.toLocaleString()}
          </Text>
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
            onMarkPaid={() => handleMarkPaid(item)}
          />
        )}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
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
  right: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 4,
  },
});