import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { useResident } from '../../context/ResidentContext';
import { useMockAuth } from '../../context/MockAuthContext';
import SectionHeader from '../../components/common/SectionHeader';
import ProfileHeader from '../../components/profile/ProfileHeader';
import InfoCard from '../../components/common/InfoCard';
import ProfileMenuItem from '../../components/profile/ProfileMenuItem';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { residentData } = useResident();
  const { logout } = useMockAuth();

  const handleMenuPress = (label: string) => {
  if (label === 'Logout') {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
    return;
  }
  if (label === 'Payment History') {
    navigation.navigate('RentDetails');
    return;
  }
  if (label === 'My Documents') {
    navigation.navigate('Documents');
    return;
  }
  if (label === 'Notifications') {
    navigation.navigate('Notifications');
    return;
  }
  if (label === 'Complaints') {
    navigation.navigate('Complaints');
    return;
  }
  if (label === 'Help & Support') {
    navigation.navigate('HelpSupport');
    return;
  }
  if (label === 'Privacy') {
  navigation.navigate('Privacy');
  return;
}
  if (label === 'Vacate Notice') {
    navigation.navigate('VacateNotice');
    return;
  }
  Alert.alert(label, 'Coming Soon');
};
  const personalInfoRows = [
  { label: 'Full Name', value: residentData.name },
  { label: 'Phone Number', value: residentData.phone },
  { label: 'Email', value: residentData.email },
  { label: 'Date of Birth', value: residentData.dob },
  { label: 'Gender', value: residentData.gender },
  { label: 'Occupation', value: residentData.occupation || '—' },
  { label: 'Company Name', value: residentData.companyName || '—' },
  { label: 'Occupation Address', value: residentData.occupationAddress || '—' },
  { label: 'Native Place', value: residentData.nativePlace || '—' },
  { label: 'Emergency Contact 1', value: residentData.emergencyContact1 || '—' },
  { label: 'Emergency Contact 2', value: residentData.emergencyContact2 || '—' },
];

  const pgInfoRows = [
    { label: 'PG Name', value: residentData.pgName },
    { label: 'Room Number', value: residentData.room },
    { label: 'Bed Number', value: residentData.bed },
    { label: 'Floor', value: residentData.floor },
    { label: 'Joining Date', value: residentData.joiningDate },
    { label: 'Monthly Rent', value: `₹${residentData.monthlyRent}` },
  ];

  const menuItems = [
    { label: 'My Documents', icon: 'document-text-outline' },
    { label: 'Payment History', icon: 'receipt-outline' },
    { label: 'Complaints', icon: 'alert-circle-outline' },
    { label: 'Notifications', icon: 'notifications-outline' },
    { label: 'Vacate Notice', icon: 'exit-outline' },
    { label: 'Help & Support', icon: 'help-circle-outline' },
    { label: 'Privacy', icon: 'lock-closed-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          name={residentData.name}
          email={residentData.email}
          phone={residentData.phone}
          onEditPress={() => navigation.navigate('EditProfile')}
        />

        <View style={styles.section}>
          <SectionHeader title="Personal Information" />
          <InfoCard rows={personalInfoRows} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="PG Information" />
          <InfoCard rows={pgInfoRows} />
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <ProfileMenuItem
                key={item.label}
                label={item.label}
                icon={item.icon}
                onPress={() => handleMenuPress(item.label)}
              />
            ))}
            <ProfileMenuItem
              label="Logout"
              icon="log-out-outline"
              isLast
              isDestructive
              onPress={() => handleMenuPress('Logout')}
            />
          </View>
        </View>
      </ScrollView>
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
  section: {
    marginTop: spacing.lg,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});