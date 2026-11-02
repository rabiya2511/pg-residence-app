import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { useResident } from '../../context/ResidentContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useAdmin } from '../../context/AdminContext';
import SectionHeader from '../../components/common/SectionHeader';
import ProfileHeader from '../../components/profile/ProfileHeader';
import InfoCard from '../../components/common/InfoCard';
import ProfileMenuItem from '../../components/profile/ProfileMenuItem';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { residentData } = useResident();
  const { logout, residentId } = useMockAuth();
  const { residents, properties } = useAdmin();

  // The PG manager's contact, from the property this resident lives in.
  const ownRecord: any = residents.find((r) => r.id === residentId);
  const ownProperty: any = ownRecord ? properties.find((p) => p.id === ownRecord.propertyId) : undefined;
  const managerName: string = ownProperty?.branchManager ?? '';
  const managerPhone: string = ownProperty?.contactPhone ?? '';
  const managerDial = managerPhone.replace(/[^\d+]/g, '');

  const handleMenuPress = (label: string) => {
  if (label === 'Logout') {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
    return;
  }
  if (label === 'Call Manager') {
    if (managerDial) {
      Linking.openURL(`tel:${managerDial}`).catch(() =>
        Alert.alert('Cannot Call', 'No phone app is available.')
      );
    }
    return;
  }
  if (label === 'Stay & Room Details') {
    navigation.navigate('StayDetails');
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
  if (label === 'Facilities & Info'){
      navigation.navigate('Facilities'); 
      return; }
    if (label === 'Feedback') 
      { navigation.navigate('Feedback'); 
        return; }

  Alert.alert(label, 'Coming Soon');
};
  const personalInfoRows = [
    { label: 'Full Name', value: residentData.name },
    { label: 'Phone Number', value: residentData.phone },
    { label: 'Email', value: residentData.email },
    { label: 'Date of Birth', value: residentData.dob },
    { label: 'Gender', value: residentData.gender },
    { label: 'Occupation', value: residentData.occupation || '—' },
    { label: 'Occupation Address', value: residentData.occupationAddress || '—' },
    { label: 'Native Place', value: residentData.nativePlace || '—' },
    { label: 'Emergency Contact 1', value: residentData.emergencyContact1 || '—' },
    { label: 'Emergency Contact 2', value: residentData.emergencyContact2 || '—' },
  ];

  const pgInfoRows = [
    { label: 'PG Name', value: residentData.pgName },
    { label: 'PG Manager', value: managerName || '—' },
    { label: 'Manager Contact', value: managerPhone || '—' },
    { label: 'Room Number', value: residentData.room },
    { label: 'Bed Number', value: residentData.bed },
    { label: 'Floor', value: residentData.floor },
    { label: 'Joining Date', value: residentData.joiningDate },
    { label: 'Monthly Rent', value: `₹${residentData.monthlyRent}` },
  ];

  const menuItems = [
    ...(managerDial ? [{ label: 'Call Manager', icon: 'call-outline' }] : []),
    { label: 'Stay & Room Details', icon: 'bed-outline' },
    { label: 'My Documents', icon: 'document-text-outline' },
    { label: 'Payment History', icon: 'receipt-outline' },
    { label: 'Complaints', icon: 'alert-circle-outline' },
    { label: 'Notifications', icon: 'notifications-outline' },
    { label: 'Help & Support', icon: 'help-circle-outline' },
    { label: 'Privacy', icon: 'lock-closed-outline' },
    { label: 'Facilities & Info', icon: 'business-outline' },
     { label: 'Feedback', icon: 'star-outline' },
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
          photoUri={residentData.profileImageUri ?? undefined}
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