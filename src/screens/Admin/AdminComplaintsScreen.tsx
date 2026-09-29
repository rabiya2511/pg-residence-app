import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminComplaint } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';

const statusColors: Record<string, { bg: string; text: string }> = {
  Open: { bg: '#FEE2E2', text: colors.error },
  'In Progress': { bg: '#FEF3C7', text: colors.warning },
  Resolved: { bg: '#D1FAE5', text: colors.success },
};

const nextStatus: Record<AdminComplaint['status'], AdminComplaint['status']> = {
  Open: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Open',
};

function ComplaintCard({
  complaint,
  onChangeStatus,
}: {
  complaint: AdminComplaint;
  onChangeStatus: () => void;
}) {
  const statusStyle = statusColors[complaint.status];
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>
          {complaint.residentName} · {complaint.room}
        </Text>
        <TouchableOpacity
          style={[styles.badge, { backgroundColor: statusStyle.bg }]}
          onPress={onChangeStatus}
          activeOpacity={0.7}
        >
          <Text style={[typography.caption, { color: statusStyle.text }]}>
            {complaint.status}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[typography.caption, { color: colors.primary, marginTop: 4 }]}>
        {complaint.category}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: 2 }]}>
        {complaint.description}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
        {complaint.date}
      </Text>
    </View>
  );
}

export default function AdminComplaintsScreen() {
  const route = useRoute<any>();
  const filterStatus: AdminComplaint['status'] | undefined = route.params?.filterStatus;
  const { complaints, updateComplaintStatus, markComplaintViewed } = useAdmin();

  const [whatsappVisible, setWhatsappVisible] = useState(false);
  const [whatsappRecipients, setWhatsappRecipients] = useState<WhatsAppRecipient[]>([]);

      const visibleComplaints = filterStatus
    ? complaints.filter((c) => c.status === filterStatus)
    : complaints;

  const handleChangeStatus = (complaint: AdminComplaint) => {
    const newStatus = nextStatus[complaint.status];
    Alert.alert('Update Status', `Change status to "${newStatus}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          updateComplaintStatus(complaint.id, newStatus);

          const statusMessages: Record<AdminComplaint['status'], string> = {
            Open: `Hi ${complaint.residentName}, your complaint (${complaint.category}) has been reopened. Our team will look into it.`,
            'In Progress': `Hi ${complaint.residentName}, your complaint (${complaint.category}) is now being worked on. We'll update you once resolved.`,
            Resolved: `Hi ${complaint.residentName}, your complaint (${complaint.category}) has been marked as resolved. Please let us know if the issue persists. — Lokansh Aditya PG Residency`,
          };

          setWhatsappRecipients([
            {
              id: complaint.id,
              name: complaint.residentName,
              message: statusMessages[newStatus],
            },
          ]);
          setWhatsappVisible(true);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.heading2, { color: colors.text }]}>
          {filterStatus ? `${filterStatus} Complaints` : 'Complaints'}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {visibleComplaints.length} total
        </Text>
      </View>

      <FlatList
        data={visibleComplaints}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ComplaintCard complaint={item} onChangeStatus={() => handleChangeStatus(item)} />
        )}
      />

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="Complaint Update"
        recipients={whatsappRecipients}
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
    padding: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
});