import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';
import { PG_UPI_ID, PG_PAYEE_NAME } from '../../constants/mockData';
import { REPORTS } from './AdminReportsScreen';
import { useAdmin, isDailyGuestActiveNow, isPreBookedNow } from '../../context/AdminContext';

// Name of the Room & Bed Management screen in your navigator.
const ROOMS_ROUTE = 'AdminRooms';

// No amount baked in — the payer scans this and types the amount themselves.
function buildStaticUpiLink(): string {
  const params = new URLSearchParams({
    pa: PG_UPI_ID,
    pn: PG_PAYEE_NAME,
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Understands "20 Oct 2026" (admin format) and "Oct 20, 2026" (seed format).
function parseAnyDate(str?: string | null): Date | null {
  if (!str) return null;
  const s = str.trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m![2].toLowerCase());
    return idx === -1 ? null : new Date(Number(m[3]), idx, Number(m[1]));
  }
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m![1].toLowerCase());
    return idx === -1 ? null : new Date(Number(m[3]), idx, Number(m[2]));
  }
  return null;
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useMockAuth();
  const {
    residents: adminResidents,
    complaints: adminComplaints,
    identityDocuments,
    dailyGuests,
    paymentRecords,
    paymentNotifications,
    vacateNotifications,
    properties,
    rooms,
    activeProperty,
    setActiveProperty,
  } = useAdmin();
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [switchVisible, setSwitchVisible] = useState(false);

  // Everything from useAdmin() is already for the active branch only.
  const activeId = activeProperty?.id;
  const [showAllActions, setShowAllActions] = useState(false);

  /* ------------------------- existing numbers ------------------------- */
  const activeResidents = adminResidents.filter((r) => !isPreBookedNow(r));
  const totalResidents = activeResidents.length;
  const pendingResidents = activeResidents.filter((r) => r.rentStatus !== 'Paid');
  const pendingRent = pendingResidents.length;
  const pendingAmount = pendingResidents.reduce((s, r) => s + r.monthlyRent, 0);
  const openComplaints = adminComplaints.filter((c) => c.status === 'Open').length;
  const vacatingCount = adminResidents.filter((r) => !!r.vacatingDate).length;

  const totalResidentRevenue = adminResidents.reduce((sum, r) => sum + r.monthlyRent, 0);
  const totalDayGuestRevenue = dailyGuests.reduce((sum, g) => sum + (g.advanceAmount ?? 0), 0);
  const totalMonthlyRevenue = totalResidentRevenue + totalDayGuestRevenue;

  const pendingDocuments = identityDocuments.filter((d) => !d.frontUri || !d.backUri).length;

  const unreadNotificationCount =
    paymentNotifications.filter((n) => !n.read).length +
    vacateNotifications.filter((n) => !n.read).length;

  const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const roomIds = new Set(rooms.map((r) => r.id));
  const occupiedByResidents = adminResidents.filter((r) => roomIds.has(r.roomId)).length;
  const occupiedByGuests = dailyGuests.filter(
    (g) => roomIds.has(g.roomId) && isDailyGuestActiveNow(g)
  ).length;
  const occupiedBeds = Math.min(totalBeds, occupiedByResidents + occupiedByGuests);
  const occupancyPercent = totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100);

  /* ------------------------- new overview numbers ------------------------- */
  const maleCount = activeResidents.filter((r) => r.gender === 'Male').length;
  const femaleCount = activeResidents.filter((r) => r.gender === 'Female').length;

  const roomStats = rooms.map((room) => {
    const occ =
      adminResidents.filter((r) => r.roomId === room.id).length +
      dailyGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g)).length;
    return { capacity: room.capacity, occupied: Math.min(room.capacity, occ) };
  });
  const fullRooms = roomStats.filter((r) => r.occupied >= r.capacity).length;
  const vacantRooms = roomStats.filter((r) => r.occupied === 0).length;
  const partialRooms = rooms.length - fullRooms - vacantRooms;
  const occupiedRooms = rooms.length - vacantRooms;
  const totalFloors = activeProperty?.floors ?? new Set(rooms.map((r) => r.floor)).size;

  const preBookedCount = adminResidents.filter((r) => isPreBookedNow(r)).length;

  const todayStr = new Date().toDateString();
  const rentToday = paymentRecords
    .filter((p) => p.status === 'Paid' && parseAnyDate(p.paidOn)?.toDateString() === todayStr)
    .reduce((s, p) => s + p.amount, 0);
  const guestsToday = dailyGuests
    .filter((g) => new Date(g.checkInTimestamp).toDateString() === todayStr)
    .reduce((s, g) => s + (g.advanceAmount ?? 0), 0);
  const todaysCollection = rentToday + guestsToday;

  const openTickets = openComplaints;
  const inProgressTickets = adminComplaints.filter((c) => c.status === 'In Progress').length;
  const resolvedTickets = adminComplaints.filter((c) => c.status === 'Resolved').length;

  const activity = [
    ...paymentNotifications.map((n) => ({
      id: n.id,
      icon: 'cash-outline' as const,
      color: colors.success,
      title: `${n.residentName} paid ${formatINR(n.amount)}`,
      sub: `${n.type ?? 'Rent'} · ${n.month}`,
      createdAt: n.createdAt,
      read: n.read,
    })),
    ...vacateNotifications.map((n) => ({
      id: n.id,
      icon: 'exit-outline' as const,
      color: colors.error,
      title: `${n.residentName} gave a vacate notice`,
      sub: `Vacating ${n.vacatingDate}${n.isEmergency ? ' · Emergency' : ''}`,
      createdAt: n.createdAt,
      read: n.read,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const propertyTitle = activeProperty?.name ?? 'No property yet';

  const handleAddRoom = () => {
    if (activeProperty) {
      navigation.navigate('AdminRoomForm', { propertyId: activeProperty.id });
    } else {
      navigation.navigate('AdminProperties');
    }
  };

  const closeSwitch = () => setSwitchVisible(false);
  const pickBranch = (id: string) => {
    setActiveProperty(id);
    closeSwitch();
  };
  const openManageProperties = () => {
    closeSwitch();
    navigation.navigate('AdminProperties');
  };

  /* ------------------------- quick actions (all existing tabs kept) ------------------------- */
  const stats = [
    { label: 'Total Residents', value: totalResidents, icon: 'people-outline', color: colors.primary, onPress: () => navigation.navigate('Residents') },
    { label: 'Pending Dues', value: pendingRent, icon: 'cash-outline', color: colors.warning, onPress: () => navigation.navigate('AdminPendingDues') },
    { label: 'Open Complaints', value: openComplaints, icon: 'alert-circle-outline', color: colors.error, onPress: () => navigation.navigate('AdminComplaints', { filterStatus: 'Open' }) },
    { label: 'Monthly Revenue', value: `₹${totalMonthlyRevenue.toLocaleString()}`, icon: 'trending-up-outline', color: colors.success, onPress: () => navigation.navigate('AdminRevenue') },
    { label: 'Documents', value: pendingDocuments, icon: 'document-text-outline', color: colors.primary, onPress: () => navigation.navigate('AdminIdentityDocuments') },
    { label: 'Properties', value: properties.length, icon: 'business-outline', color: colors.warning, onPress: () => navigation.navigate('AdminProperties') },
    { label: 'Day Guests', value: dailyGuests.length, icon: 'person-add-outline', color: colors.success, onPress: () => navigation.navigate('AdminDailyGuests') },
    { label: 'Vacating', value: vacatingCount, icon: 'exit-outline', color: colors.error, onPress: () => navigation.navigate('AdminVacating') },
    { label: 'Day Revenue', value: `₹${totalDayGuestRevenue.toLocaleString()}`, icon: 'calendar-outline', color: colors.success, onPress: () => navigation.navigate('AdminDayRevenue') },
    { label: 'Analytics', value: `${occupancyPercent}%`, icon: 'analytics-outline', color: colors.primary, onPress: () => navigation.navigate('AdminAnalytics') },
    { label: 'Room Allocation', value: `${occupiedBeds}/${totalBeds}`, icon: 'bed-outline', color: colors.primary, onPress: () => navigation.navigate(ROOMS_ROUTE) },
    { label: 'Reports', value: REPORTS.length, icon: 'bar-chart-outline', color: colors.primary, onPress: () => navigation.navigate('AdminReports') },
    { label: 'Messages', value: 'Open', icon: 'chatbubbles-outline', color: colors.primary, onPress: () => navigation.navigate('AdminCommunications') },
  ];

  const quickActions = [
    { label: 'Add Resident', value: '', icon: 'person-add-outline', color: colors.primary, onPress: () => navigation.navigate('AdminResidentForm', {}) },
    { label: 'Add Day Guest', value: '', icon: 'add-circle-outline', color: colors.success, onPress: () => navigation.navigate('AdminDailyGuestForm') },
    { label: 'Send Notice', value: '', icon: 'megaphone-outline', color: colors.primary, onPress: () => navigation.navigate('AdminNotices') },
    { label: 'Call', value: '', icon: 'call-outline', color: colors.success, onPress: () => navigation.navigate('AdminDialer') },
    ...stats,
  ];
  const visibleActions = showAllActions ? quickActions : quickActions.slice(0, 9);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <Image
          source={activeProperty?.logoUri ? { uri: activeProperty.logoUri } : require('../../../assets/pg-logo.png')}
          style={styles.logo}
        />
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.8}
          onPress={() => setSwitchVisible(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[typography.heading3, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {propertyTitle}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.warning} style={{ marginLeft: 4 }} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {totalFloors} Floor{totalFloors !== 1 ? 's' : ''} · {rooms.length} Rooms
          </Text>
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]} numberOfLines={1}>
            Admin · Tap to switch
          </Text>
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setQrModalVisible(true)} style={styles.headerIconButton}>
            <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate('AdminPaymentNotifications')}>
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
        {/* ---------------- Today's Overview ---------------- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.heading3, { color: colors.text }]}>Today's Overview</Text>
          <View style={styles.liveBadge}>
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>LIVE</Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>{todayLabel}</Text>

        <View style={styles.overviewGrid}>
          <TouchableOpacity style={styles.overviewCard} activeOpacity={0.85} onPress={() => navigation.navigate('Residents')}>
            <View style={[styles.overviewIcon, { backgroundColor: `${colors.success}20` }]}>
              <Ionicons name="people" size={20} color={colors.success} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>Total Residents</Text>
            <Text style={[typography.heading2, { color: colors.text }]}>{totalResidents}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{maleCount}M · {femaleCount}F</Text>
            <Text style={[typography.caption, styles.cardLink]}>Directory →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.overviewCard} activeOpacity={0.85} onPress={() => navigation.navigate(ROOMS_ROUTE)}>
            <View style={[styles.overviewIcon, { backgroundColor: `${colors.warning}20` }]}>
              <Ionicons name="business" size={20} color={colors.warning} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>Occupied Rooms</Text>
            <Text style={[typography.heading2, { color: colors.text }]}>{occupiedRooms}/{rooms.length}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{occupancyPercent}% Occupancy</Text>
            <Text style={[typography.caption, styles.cardLink]}>Rooms Grid →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.overviewCard} activeOpacity={0.85} onPress={() => navigation.navigate('AdminPendingDues')}>
            <View style={[styles.overviewIcon, { backgroundColor: `${colors.error}20` }]}>
              <Ionicons name="hourglass" size={20} color={colors.error} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>Pending Dues</Text>
            <Text style={[typography.heading2, { color: colors.error }]}>{formatINR(pendingAmount)}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{pendingRent} residents</Text>
            <Text style={[typography.caption, styles.cardLink]}>Track Dues →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.overviewCard} activeOpacity={0.85} onPress={() => navigation.navigate('AdminRevenue')}>
            <View style={[styles.overviewIcon, { backgroundColor: `${colors.success}20` }]}>
              <Ionicons name="wallet" size={20} color={colors.success} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>Today's Collection</Text>
            <Text style={[typography.heading2, { color: colors.success }]}>{formatINR(todaysCollection)}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Live receipts</Text>
            <Text style={[typography.caption, styles.cardLink]}>Collections →</Text>
          </TouchableOpacity>
        </View>

        {/* ---------------- Rooms & Availability ---------------- */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={[typography.heading3, { color: colors.text }]}>Rooms & Availability</Text>
            <View style={styles.countBadge}>
              <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>{rooms.length} Rooms</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addRoomButton} activeOpacity={0.85} onPress={handleAddRoom}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 2 }]}>Add Room</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bigCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.overviewIcon, { backgroundColor: `${colors.warning}20` }]}>
              <Ionicons name="bed" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Room & Availability Dashboard</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Live Beds, Bookings & Exit Pipeline</Text>
            </View>
            <View style={styles.bedsOpenBadge}>
              <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                {totalBeds - occupiedBeds} Beds Open
              </Text>
            </View>
          </View>

          <View style={styles.occRow}>
            <Text style={[typography.heading2, { color: colors.text }]}>{occupancyPercent}%</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 6, flex: 1 }]}>Occupied</Text>
            <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
              {occupiedBeds} / {totalBeds} Total Beds
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, occupancyPercent)}%` }]} />
          </View>

          <View style={styles.tileRow}>
            <View style={styles.tile}>
              <Text style={[typography.heading3, { color: colors.text }]}>{rooms.length}</Text>
              <Text style={styles.tileLabel}>Total Rooms</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: `${colors.success}15` }]}>
              <Text style={[typography.heading3, { color: colors.success }]}>{fullRooms}</Text>
              <Text style={styles.tileLabel}>Full</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: `${colors.warning}15` }]}>
              <Text style={[typography.heading3, { color: colors.warning }]}>{partialRooms}</Text>
              <Text style={styles.tileLabel}>Partial</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: `${colors.error}15` }]}>
              <Text style={[typography.heading3, { color: colors.error }]}>{vacantRooms}</Text>
              <Text style={styles.tileLabel}>Vacant</Text>
            </View>
          </View>

          <View style={styles.miniRow}>
            <TouchableOpacity
              style={styles.miniCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AdminPreBookingProperties')}
            >
              <View style={styles.miniTop}>
                <View style={[styles.miniIcon, { backgroundColor: `${colors.warning}20` }]}>
                  <Ionicons name="bookmark" size={16} color={colors.warning} />
                </View>
                <View style={styles.miniBadge}>
                  <Text style={[typography.caption, { color: colors.warning, fontWeight: '700', fontSize: 11 }]}>
                    {preBookedCount} Active
                  </Text>
                </View>
              </View>
              <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.xs }]}>{preBookedCount}</Text>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Pre-Booking Count</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Reserved / Advance</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.miniCard} activeOpacity={0.85} onPress={() => navigation.navigate('AdminVacating')}>
              <View style={styles.miniTop}>
                <View style={[styles.miniIcon, { backgroundColor: `${colors.success}20` }]}>
                  <Ionicons name="exit" size={16} color={colors.success} />
                </View>
                <View style={[styles.miniBadge, { backgroundColor: `${colors.success}20` }]}>
                  <Text style={[typography.caption, { color: colors.success, fontWeight: '700', fontSize: 11 }]}>
                    {vacatingCount} Notice
                  </Text>
                </View>
              </View>
              <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.xs }]}>{vacatingCount}</Text>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Exit Count</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Notice / Vacating</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.assignLink} activeOpacity={0.85} onPress={() => navigation.navigate(ROOMS_ROUTE)}>
            <Text style={[typography.bodyBold, { color: colors.primary, flex: 1 }]}>Assign Residents & Manage Beds</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ---------------- Quick Actions ---------------- */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
          <Text style={[typography.heading3, { color: colors.text }]}>Quick Actions</Text>
          <TouchableOpacity onPress={() => setShowAllActions((prev) => !prev)}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
              {showAllActions ? 'Show Less' : 'View All'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionsGrid}>
          {visibleActions.map((a) => (
            <TouchableOpacity key={a.label} style={styles.actionItem} activeOpacity={0.8} onPress={a.onPress}>
              <View style={[styles.actionCircle, { borderColor: a.color }]}>
                <Ionicons name={a.icon as any} size={26} color={a.color} />
                {typeof a.value === 'number' && a.value > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{a.value > 99 ? '99+' : a.value}</Text>
                  </View>
                )}
              </View>
              <Text style={[typography.caption, { color: colors.text, textAlign: 'center', marginTop: 6 }]} numberOfLines={2}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------------- Maintenance ---------------- */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
          <Text style={[typography.heading3, { color: colors.text }]}>Maintenance</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AdminComplaints')}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Manage →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bigCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.overviewIcon, { backgroundColor: `${colors.warning}20` }]}>
              <Ionicons name="construct" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Property Maintenance</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {adminComplaints.length} Total Tickets · {inProgressTickets} In Progress
              </Text>
            </View>
          </View>
          <View style={styles.maintRow}>
            <View style={styles.maintItem}>
              <Text style={[typography.heading3, { color: colors.error }]}>{openTickets}</Text>
              <Text style={styles.tileLabel}>Open</Text>
            </View>
            <View style={styles.maintItem}>
              <Text style={[typography.heading3, { color: colors.warning }]}>{inProgressTickets}</Text>
              <Text style={styles.tileLabel}>In Progress</Text>
            </View>
            <View style={styles.maintItem}>
              <Text style={[typography.heading3, { color: colors.success }]}>{resolvedTickets}</Text>
              <Text style={styles.tileLabel}>Resolved</Text>
            </View>
            <View style={styles.maintItem}>
              <Text style={[typography.heading3, { color: colors.text }]}>{adminComplaints.length}</Text>
              <Text style={styles.tileLabel}>Total</Text>
            </View>
          </View>

          {adminComplaints.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                Recent Complaints
              </Text>
              {adminComplaints.slice(0, 3).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.recentRow}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('AdminComplaints')}
                >
                  <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                    {c.residentName} · {c.room}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {c.category}: {c.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ---------------- Notifications & Activity ---------------- */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={[typography.heading3, { color: colors.text }]}>Notifications & Activity</Text>
            <View style={styles.countBadge}>
              <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>{activity.length} Events</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('AdminPaymentNotifications')}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bigCard}>
          {activity.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>No recent activity recorded yet.</Text>
          ) : (
            activity.slice(0, 5).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.activityRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminPaymentNotifications')}
              >
                <View style={[styles.miniIcon, { backgroundColor: `${a.color}20` }]}>
                  <Ionicons name={a.icon} size={16} color={a.color} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{a.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{a.sub}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{timeAgo(a.createdAt)}</Text>
                  {!a.read && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* ---------------- Switch Branch sheet ---------------- */}
      <Modal visible={switchVisible} transparent animationType="slide" onRequestClose={closeSwitch}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeSwitch}>
          <TouchableOpacity activeOpacity={1} style={styles.branchSheet} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.heading3, { color: colors.text }]}>Switch Branch</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  Select active property for Admin Portal
                </Text>
              </View>
              <TouchableOpacity onPress={closeSwitch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, marginTop: spacing.md }} showsVerticalScrollIndicator={false}>
              {properties.length === 0 && (
                <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', padding: spacing.md }]}>
                  No properties yet.
                </Text>
              )}
              {properties.map((p) => {
                const isActive = p.id === activeId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.branchRow, isActive && styles.branchRowActive]}
                    activeOpacity={0.85}
                    onPress={() => pickBranch(p.id)}
                  >
                    <Image
                      source={p.logoUri ? { uri: p.logoUri } : require('../../../assets/pg-logo.png')}
                      style={styles.branchLogo}
                    />
                    <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                      <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                        {[p.address, p.floors ? `${p.floors} Floor${p.floors !== 1 ? 's' : ''}` : null].filter(Boolean).join(' • ')}
                      </Text>
                      <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]} numberOfLines={1}>
                        Manager: {p.branchManager ?? 'Unassigned'}{p.contactPhone ? ` (${p.contactPhone})` : ''}
                      </Text>
                    </View>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.manageButton} activeOpacity={0.85} onPress={openManageProperties}>
              <Ionicons name="settings" size={18} color={colors.white} />
              <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Manage All Properties</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ---------------- Payment QR ---------------- */}
      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQrModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Instant Payment QR</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.qrCard}>
              <QRCode value={buildStaticUpiLink()} size={220} />
              <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.md }]}>{PG_PAYEE_NAME}</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{PG_UPI_ID}</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  logo: { width: 44, height: 44, borderRadius: radius.sm, marginRight: spacing.sm },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  headerIconButton: { padding: 4 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  liveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
    marginRight: 'auto',
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },

  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  overviewCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  overviewIcon: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  cardLink: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },

  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },

  bigCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bedsOpenBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  occRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.warning },
  tileRow: { flexDirection: 'row', gap: spacing.xs },
  tile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  tileLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  miniRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  miniCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  miniTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniIcon: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  miniBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  assignLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  actionItem: { width: '33.33%', alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: 4 },
  actionCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  maintRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  maintItem: { flex: 1, alignItems: 'center' },
  recentRow: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, marginTop: 4 },

  bellButton: { position: 'relative' },
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
  bellBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  branchSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  branchRowActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `${colors.primary}15` },
  branchLogo: { width: 48, height: 48, borderRadius: radius.sm },
  activeBadge: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  activeBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qrCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});