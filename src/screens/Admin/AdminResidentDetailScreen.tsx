import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { properties } from '../../constants/mockData';


const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
  Open: { bg: '#FEE2E2', text: colors.error },
  'In Progress': { bg: '#FEF3C7', text: colors.warning },
  Resolved: { bg: '#D1FAE5', text: colors.success },
};

function handleMessage(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`sms:${cleaned}`).catch(() => {
    Alert.alert('Unable to Message', 'Could not open the messaging app.');
  });
}

function handleCall(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Unable to Call', 'Could not open the dialer.');
  });
}

function handleWhatsApp(phone: string) {
  const cleaned = phone.replace(/[^\d]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}`).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

export default function AdminResidentDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { residentId } = route.params;
  const { residents, complaints, markRentPaid, rooms } = useAdmin();

  const resident = residents.find((r) => r.id === residentId);
  const residentComplaints = complaints.filter((c) => c.residentName === resident?.name);

  if (!resident) return null;

  const rentStatusStyle = statusColors[resident.rentStatus];

  const residentRoom = rooms.find((r) => r.id === resident.roomId);
  const residentProperty = properties.find((p) => p.id === resident.propertyId);

  const fullRoomHistory = (resident.roomHistory ?? []).slice().reverse();

  const handleMarkPaid = () => {
    Alert.alert('Mark Rent as Paid', `Confirm ₹${resident.monthlyRent} received from ${resident.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => markRentPaid(resident.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Resident Details</Text>
    <TouchableOpacity
    onPress={() => navigation.navigate('AdminResidentForm', { residentId: resident.id })}
    style={styles.backButton}
    >
  <Ionicons name="create-outline" size={22} color={colors.text} />
</TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {resident.profileImageUri ? (
              <Image source={{ uri: resident.profileImageUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={32} color={colors.primary} />
            )}
          </View>
          <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.sm }]}>
            {resident.name}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{resident.phone}</Text>

          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactButton}
              activeOpacity={0.8}
              onPress={() => handleMessage(resident.phone)}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              activeOpacity={0.8}
              onPress={() => handleCall(resident.phone)}
            >
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              activeOpacity={0.8}
              onPress={() => handleWhatsApp(resident.phone)}
            >
              <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
              <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Room</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              {residentRoom ? `${residentRoom.roomNumber} (${residentRoom.capacity} Sharing)` : '—'}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Property</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              {residentProperty?.name ?? '—'}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Joined</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.joiningDate}</Text>
          </View>
        </View>

        {(resident.emergencyContact1 || resident.emergencyContact2) && (
          <>
            <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Emergency Contacts
            </Text>
            <View style={styles.infoCard}>
              {resident.emergencyContact1 && (
                <View style={styles.infoRow}>
                  <Text style={[typography.body, { color: colors.textMuted }]}>Contact 1</Text>
                  <TouchableOpacity onPress={() => handleCall(resident.emergencyContact1!)}>
                    <Text style={[typography.bodyBold, { color: colors.primary }]}>
                      {resident.emergencyContact1}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {resident.emergencyContact2 && (
                <View style={[styles.infoRow, resident.emergencyContact1 && styles.infoRowBorder]}>
                  <Text style={[typography.body, { color: colors.textMuted }]}>Contact 2</Text>
                  <TouchableOpacity onPress={() => handleCall(resident.emergencyContact2!)}>
                    <Text style={[typography.bodyBold, { color: colors.primary }]}>
                      {resident.emergencyContact2}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {fullRoomHistory.length > 0 && (
          <>
            <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Room History
            </Text>
            {fullRoomHistory.map((h) => {
              const histRoom = rooms.find((r) => r.id === h.roomId);
              const histProperty = properties.find((p) => p.id === h.propertyId);
              const isCurrent = h.toDate === null;
              return (
                <View key={h.id} style={styles.historyCard}>
                  <View style={styles.historyIconWrap}>
                    <Ionicons
                      name={isCurrent ? 'checkmark-circle-outline' : 'time-outline'}
                      size={18}
                      color={isCurrent ? colors.success : colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.historyTitleRow}>
                      <Text style={[typography.bodyBold, { color: colors.text }]}>
                        {histRoom
                          ? `${histRoom.roomNumber} (${histRoom.capacity} Sharing) · Floor ${histRoom.floor}`
                          : 'Unknown Room'}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={[typography.caption, { color: colors.success }]}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {histProperty?.name ?? 'Unknown Property'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {h.fromDate} – {isCurrent ? 'Present' : h.toDate}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <TouchableOpacity
          style={styles.monitoringButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminResidentMonitoring', { residentId: resident.id })}
        >
          <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.primary, marginLeft: spacing.xs }]}>
            View Documents & Payments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fullDetailsButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminResidentFullDetails', { residentId: resident.id })}
        >
          <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.primary, marginLeft: spacing.xs }]}>
            View More
          </Text>
        </TouchableOpacity>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Rent
        </Text>
        <View style={styles.rentCard}>
          <View>
            <Text style={[typography.heading2, { color: colors.text }]}>₹{resident.monthlyRent}</Text>
            <View style={[styles.badge, { backgroundColor: rentStatusStyle.bg, marginTop: 4 }]}>
              <Text style={[typography.caption, { color: rentStatusStyle.text }]}>
                {resident.rentStatus}
              </Text>
            </View>
          </View>
          {resident.rentStatus !== 'Paid' && (
            <TouchableOpacity style={styles.markPaidButton} activeOpacity={0.85} onPress={handleMarkPaid}>
              <Text style={[typography.button, { color: colors.white }]}>Mark as Paid</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Complaints ({residentComplaints.length})
        </Text>
        {residentComplaints.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>No complaints raised.</Text>
        ) : (
          residentComplaints.map((c) => {
            const style = statusColors[c.status];
            return (
              <View key={c.id} style={styles.complaintCard}>
                <View style={styles.headerRow}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{c.category}</Text>
                  <View style={[styles.badge, { backgroundColor: style.bg }]}>
                    <Text style={[typography.caption, { color: style.text }]}>{c.status}</Text>
                  </View>
                </View>
                <Text style={[typography.body, { color: colors.textMuted, marginTop: 2 }]}>
                  {c.description}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
    avatarImage: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
  },
  
  contactRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },

  contactButton: {
    alignItems: 'center',
  },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  historyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },

  currentBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  monitoringButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },

  fullDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },

  rentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  markPaidButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },

  complaintCard: {
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
});