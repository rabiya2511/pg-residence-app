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
import SectionHeader from '../../components/common/SectionHeader';
import StayOverviewCard from '../../components/home/StayOverviewCard';
import QuickActionCard from '../../components/home/QuickActionCard';
import RentStatusCard from '../../components/home/RentStatusCard';
import AnnouncementCard from '../../components/home/AnnouncementCard';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { rentStatus } = useRent();
  const { residentData } = useResident();
  const { announcements, pendingResidentNotice, clearPendingResidentNotice } = useAnnouncements();

   const [whatsappVisible, setWhatsappVisible] = useState(false);
  const [newNoticeRecipients, setNewNoticeRecipients] = useState<WhatsAppRecipient[]>([]);

  useEffect(() => {
    if (pendingResidentNotice) {
      setNewNoticeRecipients([
        {
          id: residentData.name,
          name: residentData.name,
          message: `📢 ${pendingResidentNotice.title}\n\n${pendingResidentNotice.description}\n\n— Lokansh Aditya PG Residency`,
        },
      ]);
      setWhatsappVisible(true);
      clearPendingResidentNotice();
    }
  }, [pendingResidentNotice]);

  const handleQuickActionPress = (actionId: string, label: string) => {
    if (actionId === 'complaints') {
      navigation.navigate('Complaints');
      return;
    }
    if (actionId === 'rent') {
      navigation.navigate('RentDetails');
      return;
    }
    if (actionId === 'maintenance') {
      navigation.navigate('Maintenance');
      return;
    }
    if (actionId === 'food') {
      navigation.navigate('Food');
      return;
    }
    if (actionId === 'notices') {
      navigation.navigate('Notices');
      return;
    }
    if (actionId === 'visitors') {
      navigation.navigate('Visitors');
      return;
    }
    if (actionId === 'nearby') {
  navigation.navigate('NearbyPlaces');
  return;
}
    if (actionId === 'vacate') {
      navigation.navigate('VacateNotice');
      return;
    }
    Alert.alert(label, 'Coming Soon');
  };

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
              <Text style={[typography.heading2, { color: colors.text }]}>
                Good Morning, {residentData.name}
              </Text>
              <Text style={[typography.body, { color: colors.textMuted }]}>
                Welcome back to your PG
              </Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}>
              <Ionicons name="person-circle-outline" size={26} color={colors.text} />
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
        />

        {/* Quick Actions */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
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
        </View>

        {/* Latest Updates */}
        <View style={styles.section}>
          <SectionHeader title="Latest Updates" />
          {announcements.map((item) => (
            <AnnouncementCard key={item.id} announcement={item} />
          ))}
        </View>
      </ScrollView>

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="New Notice"
        recipients={newNoticeRecipients}
      />
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
});