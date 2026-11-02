import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { quickActions } from '../../constants/mockData';
import { useRent } from '../../context/RentContext';
import { useResident } from '../../context/ResidentContext';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { useComplaints } from '../../context/ComplaintsContext';
import { useVisitors } from '../../context/VisitorsContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useNoticeReads } from '../../utils/noticeReads';
import SectionHeader from '../../components/common/SectionHeader';
import ResidentAvatar from '../../components/common/ResidentAvatar';
import StayOverviewCard from '../../components/home/StayOverviewCard';
import QuickActionCard from '../../components/home/QuickActionCard';
import RentStatusCard from '../../components/home/RentStatusCard';
import AnnouncementCard from '../../components/home/AnnouncementCard';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';
import { ResidentAdPopup } from '../../components/common/AdPopupModal';

// Greeting follows the phone's local time instead of always saying "Good Morning".
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const LATEST_UPDATES_LIMIT = 3;

// Quick action id -> screen. An id that is not listed here shows "Coming Soon".
const ACTION_ROUTES: Record<string, string> = {
  complaints: 'Complaints',
  rent: 'RentDetails',
  maintenance: 'Maintenance',
  food: 'Food',
  notices: 'Notices',
  visitors: 'Visitors',
  nearby: 'NearbyPlaces',
  vacate: 'VacateNotice',
  documents: 'Documents',
  laundry: 'Laundry',
  facilities: 'Facilities',
  feedback: 'Feedback',
  rules: 'Rules',
};

// Extra tiles added on top of the sample quickActions in mockData (skipped if mockData already has the id).
const EXTRA_ACTIONS = [
  { id: 'facilities', label: 'Facilities', icon: 'business-outline' },
  { id: 'feedback', label: 'Feedback', icon: 'star-outline' },
  { id: 'rules', label: 'Rules', icon: 'book-outline' },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { rentStatus } = useRent();
  const { residentData } = useResident();
  const { announcements, pendingResidentNotice, clearPendingResidentNotice } = useAnnouncements();
  const { complaints } = useComplaints();
  const { visitorLogs } = useVisitors();
  const { residentId } = useMockAuth();
  const { isRead } = useNoticeReads(residentId);
  const { residents } = useAdmin();
  const ownRecord: any = residents.find((r) => r.id === residentId);
  const unreadNotices = announcements.filter((n) => !isRead(n.id)).length;

  const [whatsappVisible, setWhatsappVisible] = useState(false);
  const [newNoticeRecipients, setNewNoticeRecipients] = useState<WhatsAppRecipient[]>([]);

  useEffect(() => {
    if (pendingResidentNotice) {
      setNewNoticeRecipients([
        {
          id: residentData.name,
          name: residentData.name,
          profileImageUri: residentData.profileImageUri,
          message: `📢 ${pendingResidentNotice.title}\n\n${pendingResidentNotice.description}\n\n— Lokansh Aditya PG Residency`,
        },
      ]);
      setWhatsappVisible(true);
      clearPendingResidentNotice();
    }
  }, [pendingResidentNotice]);

  const handleQuickActionPress = (actionId: string, label: string) => {
    const route = ACTION_ROUTES[actionId];
    if (route) {
      navigation.navigate(route);
      return;
    }
    Alert.alert(label, 'Coming Soon');
  };

  const allActions = [
    ...quickActions,
    ...EXTRA_ACTIONS.filter((e) => !quickActions.some((q: any) => q.id === e.id)),
  ];

  const latestUpdates = announcements.slice(0, LATEST_UPDATES_LIMIT);
  const hasDeduction = (rentStatus.deduction ?? 0) > 0;

  // "At a glance" tiles, all live from the same data the other screens use.
  const pendingComplaints = complaints.filter((c) => c.status !== 'Resolved').length;
  const visitorsInside = visitorLogs.filter((v) => v.status === 'Checked In').length;
  const visitorsPending = visitorLogs.filter((v) => v.status === 'Pending').length;
  const deposit = Number(ownRecord?.securityDeposit) || 0;
  const exitNoticeGiven = residentData.stayStatus === 'Notice Given';
  const outstanding = rentStatus.totalOutstanding;
  const glance = [
    {
      key: 'dues',
      icon: 'wallet-outline',
      label: 'Outstanding',
      value: `₹${outstanding.toLocaleString('en-IN')}`,
      alert: outstanding > 0,
      onPress: () => navigation.navigate('RentDetails'),
    },
    {
      key: 'complaints',
      icon: 'construct-outline',
      label: 'Pending complaints',
      value: String(pendingComplaints),
      alert: pendingComplaints > 0,
      onPress: () => navigation.navigate('Complaints'),
    },
    {
      key: 'visitors',
      icon: 'people-outline',
      label: 'Visitors inside',
      value: String(visitorsInside),
      alert: false,
      onPress: () => navigation.navigate('Visitors'),
    },
    {
      key: 'visitorRequests',
      icon: 'person-add-outline',
      label: 'Visitor requests pending',
      value: String(visitorsPending),
      alert: visitorsPending > 0,
      onPress: () => navigation.navigate('Visitors'),
    },
    {
      key: 'exit',
      icon: 'exit-outline',
      label: 'Exit notice',
      value: exitNoticeGiven ? 'Submitted' : 'None',
      alert: exitNoticeGiven,
      onPress: () => navigation.navigate('VacateNotice'),
    },
    {
      key: 'deposit',
      icon: 'shield-checkmark-outline',
      label: 'Security deposit',
      value: deposit > 0 ? `₹${deposit.toLocaleString('en-IN')}` : 'None',
      alert: false,
      onPress: () => navigation.navigate('StayDetails'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require('../../../assets/pg-logo.png')} style={styles.logo} />
            <View style={{ flexShrink: 1 }}>
              <Text style={[typography.heading2, { color: colors.text }]} numberOfLines={1}>
                {getGreeting()}, {residentData.name}
              </Text>
              <Text style={[typography.body, { color: colors.textMuted }]}>
                Welcome back to your PG
              </Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              {unreadNotices > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadNotices > 9 ? '9+' : unreadNotices}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
            >
              <ResidentAvatar uri={residentData.profileImageUri} name={residentData.name} size={32} />
            </TouchableOpacity>
          </View>
        </View>

        {/* My Stay */}
        <StayOverviewCard
          pgName={residentData.pgName}
          room={residentData.room}
          bed={residentData.bed}
          monthlyRent={residentData.monthlyRent}
          nextDueDate={residentData.nextDueDate}
          stayStatus={residentData.stayStatus}
          floor={residentData.floor}
          checkInDate={residentData.joiningDate}
        />

        {/* Quick Actions */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsGrid}>
            {allActions.map((action, index) => (
              <QuickActionCard
                key={action.id}
                label={action.label}
                icon={action.icon}
                onPress={() => handleQuickActionPress(action.id, action.label)}
                style={index % 3 !== 2 ? { marginRight: '3.5%' } : undefined}
              />
            ))}
          </View>
        </View>

        {/* Rent Status */}
        <View style={styles.section}>
          <RentStatusCard
            amount={rentStatus.amount}
            monthLabel={rentStatus.monthLabel}
            dueInDays={rentStatus.dueInDays}
            status={rentStatus.status}
          />
          {hasDeduction && (
            <View style={styles.deductionNote}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.deductionText}>
                ₹{rentStatus.deduction} deducted by admin
                {rentStatus.deductionReason ? ` · ${rentStatus.deductionReason}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* At a glance */}
        <View style={styles.section}>
          <SectionHeader title="At a Glance" />
          <View style={styles.glanceGrid}>
            {glance.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.glanceTile, g.alert && styles.glanceTileAlert]}
                activeOpacity={0.8}
                onPress={g.onPress}
              >
                <Ionicons name={g.icon as any} size={20} color={g.alert ? colors.error : colors.primary} />
                <Text style={[styles.glanceValue, g.alert && { color: colors.error }]} numberOfLines={1}>
                  {g.value}
                </Text>
                <Text style={styles.glanceLabel} numberOfLines={1}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Latest Updates */}
        <View style={styles.section}>
          <SectionHeader title="Latest Updates" />
          {latestUpdates.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="megaphone-outline" size={22} color={colors.textMuted} />
              <Text style={styles.emptyText}>No new updates right now.</Text>
            </View>
          ) : (
            latestUpdates.map((item) => (
              <AnnouncementCard key={item.id} announcement={item} />
            ))
          )}
          {announcements.length > LATEST_UPDATES_LIMIT && (
            <TouchableOpacity
              style={styles.viewAll}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Notices')}
            >
              <Text style={styles.viewAllText}>View all notices</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="New Notice"
        recipients={newNoticeRecipients}
      />

      {/* Admin's advertisement pop-up: opens by itself once per login when a live ad exists */}
      <ResidentAdPopup />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
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
  },
  iconButton: {
    marginLeft: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  glanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  glanceTile: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  glanceTileAlert: { borderColor: colors.error },
  glanceValue: { marginTop: 6, fontSize: 18, fontWeight: '700', color: colors.text },
  glanceLabel: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  deductionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  deductionText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 2,
  },
});