import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { PG_UPI_ID, PG_PAYEE_NAME } from '../../constants/mockData';
import { REPORTS } from './AdminReportsScreen';

// Name of the Room & Bed Management screen in your navigator.
// Change this if your route is registered under a different name.
const ROOMS_ROUTE = 'AdminRooms';

// No amount baked in — the payer scans this and types the amount themselves
// in their own UPI app (GPay/PhonePe/Paytm etc. all support this).
function buildStaticUpiLink(): string {
  const params = new URLSearchParams({
    pa: PG_UPI_ID,
    pn: PG_PAYEE_NAME,
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useMockAuth();
  const {
    residents: adminResidents,
    complaints: adminComplaints,
    identityDocuments,
    dailyGuests,
    paymentNotifications,
    vacateNotifications,
    properties,
    rooms,
  } = useAdmin();
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const totalResidents = adminResidents.length;
  const pendingRent = adminResidents.filter((r) => r.rentStatus !== 'Paid').length;
  const openComplaints = adminComplaints.filter((c) => c.status === 'Open').length;
  const vacatingCount = adminResidents.filter((r) => !!r.vacatingDate).length;

  const totalResidentRevenue = adminResidents.reduce((sum, r) => sum + r.monthlyRent, 0);
  // Day guest payments actually collected so far (advanceAmount tracks running
  // received amount, updated live by recordDailyGuestPayment) — added on top
  // of resident rent so total revenue reflects both income sources.
  const totalDayGuestRevenue = dailyGuests.reduce((sum, g) => sum + (g.advanceAmount ?? 0), 0);
  const totalMonthlyRevenue = totalResidentRevenue + totalDayGuestRevenue;

  const pendingDocuments = identityDocuments.filter((d) => !d.frontUri || !d.backUri).length;

  const unreadNotificationCount =
    paymentNotifications.filter((n) => !n.read).length +
    vacateNotifications.filter((n) => !n.read).length;

  // Room allocation numbers: beds taken by residents plus day guests who are
  // currently staying, measured against total bed capacity of the rooms.
  const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const roomIds = new Set(rooms.map((r) => r.id));
  const occupiedByResidents = adminResidents.filter((r) => roomIds.has(r.roomId)).length;
  const occupiedByGuests = dailyGuests.filter(
    (g) => roomIds.has(g.roomId) && isDailyGuestActiveNow(g)
  ).length;
  const occupiedBeds = Math.min(totalBeds, occupiedByResidents + occupiedByGuests);

  const stats = [
    {
      label: 'Total Residents',
      value: totalResidents,
      icon: 'people-outline',
      color: colors.primary,
      onPress: () => navigation.navigate('Residents'),
    },
    {
      label: 'Pending Rent',
      value: pendingRent,
      icon: 'cash-outline',
      color: colors.warning,
      onPress: () => navigation.navigate('Residents', { filterRentStatus: 'PendingOrOverdue' }),
    },
    {
      label: 'Open Complaints',
      value: openComplaints,
      icon: 'alert-circle-outline',
      color: colors.error,
      onPress: () => navigation.navigate('AdminComplaints', { filterStatus: 'Open' }),
    },
    {
      label: 'Monthly Revenue',
      value: `₹${totalMonthlyRevenue.toLocaleString()}`,
      icon: 'trending-up-outline',
      color: colors.success,
      onPress: () => navigation.navigate('AdminRevenue'),
    },
    {
      label: 'Documents',
      value: pendingDocuments,
      icon: 'document-text-outline',
      color: colors.primary,
      onPress: () => navigation.navigate('AdminIdentityDocuments'),
    },
    {
      label: 'Properties',
      value: properties.length,
      icon: 'business-outline',
      color: colors.warning,
      onPress: () => navigation.navigate('AdminProperties'),
    },
    {
      label: 'Day Guests',
      value: dailyGuests.length,
      icon: 'person-add-outline',
      color: colors.success,
      onPress: () => navigation.navigate('AdminDailyGuests'),
    },
    {
      label: 'Vacating',
      value: vacatingCount,
      icon: 'exit-outline',
      color: colors.error,
      onPress: () => navigation.navigate('AdminVacating'),
    },
    {
      label: 'Day Revenue',
      value: `₹${totalDayGuestRevenue.toLocaleString()}`,
      icon: 'calendar-outline',
      color: colors.success,
      onPress: () => navigation.navigate('AdminDayRevenue'),
    },
    {
      label: 'Smart Dialer',
      value: adminResidents.length,
      icon: 'call-outline',
      color: colors.success,
      onPress: () => navigation.navigate('AdminDialer'),
    },

    // ── 4th row: room allocation ──
    {
      label: 'Room Allocation',
      value: `${occupiedBeds}/${totalBeds}`,
      icon: 'bed-outline',
      color: colors.primary,
      onPress: () => navigation.navigate(ROOMS_ROUTE),
    },

    // ── NEW: reports (opens the Reports & Audits list) ──
        {
      label: 'Reports',
      value: REPORTS.length,
      icon: 'bar-chart-outline',
      color: colors.primary,
      onPress: () => navigation.navigate('AdminReports'),
    },
     
  ];
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../../assets/pg-logo.png')} style={styles.logo} />
          <View style={{ flexShrink: 1 }}>
          <Text style={[typography.heading2, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          Admin Dashboard
        </Text>
              <Text style={[typography.body, { color: colors.textMuted }]} numberOfLines={1}>
              {properties.length === 0
                ? 'No property yet'
                : properties.length === 1
                ? properties[0].name
                : `${properties[0].name} +${properties.length - 1} more`}
            </Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setQrModalVisible(true)} style={styles.headerIconButton}>
            <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('AdminPaymentNotifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {unreadNotificationCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={logout}>
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <TouchableOpacity
              key={stat.label}
              style={styles.statCard}
              activeOpacity={0.8}
              onPress={stat.onPress}
            >
              <View style={[styles.statIconWrap, { backgroundColor: `${stat.color}20` }]}>
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
              </View>
              <Text style={[typography.heading3, { color: colors.text, marginTop: 4 }]}>
                {stat.value}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {stat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { marginRight: spacing.xs }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminNotices')}
          >
            <Ionicons name="megaphone-outline" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, marginLeft: 6, fontWeight: '600' }]}>
              Send Notice
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success, marginLeft: spacing.xs }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminDailyGuestForm')}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, marginLeft: 6, fontWeight: '600' }]}>
              Add Day Guest
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
            Recent Complaints
          </Text>
          {adminComplaints.slice(0, 3).map((c) => (
            <View key={c.id} style={styles.recentCard}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>
                {c.residentName} · {c.room}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {c.category}: {c.description}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setQrModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Instant Payment QR</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.qrCard}>
              <QRCode value={buildStaticUpiLink()} size={220} />
              <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.md }]}>
                {PG_PAYEE_NAME}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {PG_UPI_ID}
              </Text>
            </View>

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }]}>
              Scan this code — the amount is entered manually in the payer's UPI app.
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconButton: {
    padding: 4,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  statCard: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: spacing.lg,
  },
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qrCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  bellButton: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});