import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';
import { useAdmin } from '../../context/AdminContext';
import { updateSettings, useAppSettings } from '../../utils/appSettings';
import LinkedAccountsCard from '../../components/common/LinkedAccountsCard';

const TIMEOUTS = [
  { label: 'Never', minutes: 0 },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
];

export default function AdminSettingsScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useMockAuth() as any;
  const { activeProperty, properties } = useAdmin();
  const { settings, update } = useAppSettings();

  // The number the admin signed in with.
  const authPhone = getAuth().currentUser?.phoneNumber ?? '';
  const phoneLabel = authPhone
    ? `Signed in with +91 ${authPhone.replace(/\D/g, '').slice(-10)}`
    : 'Signed in with your phone number';

  const toggleBiometric = async (on: boolean) => {
    if (!on) {
      updateSettings({ biometricLock: false });
      return;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        Alert.alert(
          'Not Available',
          'Set up a fingerprint, face unlock or screen lock in your phone settings first, then try again.'
        );
        return;
      }
      // Confirm it works before turning it on, so nobody gets locked out by mistake.
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to turn on app lock' });
      if (result.success) updateSettings({ biometricLock: true });
    } catch {
      Alert.alert('Not Available', 'Biometric lock could not be turned on on this device.');
    }
  };

  const confirmLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to log out of the admin app?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);

  const Row = ({ icon, title, sub, right, onPress }: { icon: any; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void }) => (
    <TouchableOpacity style={styles.row} activeOpacity={onPress ? 0.7 : 1} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[typography.body, { color: colors.text }]}>{title}</Text>
        {!!sub && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Admin Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>ACCOUNT</Text>
        <View style={styles.card}>
          <Row icon="shield-checkmark-outline" title="Admin" sub={phoneLabel} />
          <View style={styles.divider} />
          <Row
            icon="business-outline"
            title={activeProperty?.name ?? 'No property selected'}
            sub={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · tap to manage`}
            onPress={() => navigation.navigate('AdminProperties')}
          />
        </View>

        <Text style={styles.section}>SECURITY</Text>
        <View style={styles.card}>
          <Row
            icon="finger-print-outline"
            title="Biometric lock"
            sub="Ask for fingerprint, face or phone PIN when opening the app"
            right={<Switch value={settings.biometricLock} onValueChange={toggleBiometric} trackColor={{ true: colors.primary }} />}
          />
        </View>
        <View style={[styles.card, { padding: spacing.md, marginTop: spacing.sm }]}>
          <Text style={[typography.body, { color: colors.text }]}>Auto logout after inactivity</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm }]}>
            You are signed out if the app is left unused for this long.
          </Text>
          <View style={styles.chipWrap}>
            {TIMEOUTS.map((t) => {
              const active = settings.autoLogoutMinutes === t.minutes;
              return (
                <TouchableOpacity key={t.minutes} onPress={() => update({ autoLogoutMinutes: t.minutes })} activeOpacity={0.8} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[typography.caption, { color: active ? colors.white : colors.text }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={[styles.card, { marginTop: spacing.sm }]}>
          <Row icon="phone-portrait-outline" title="This device" sub={`${Platform.OS === 'android' ? 'Android' : 'iPhone'} · currently signed in`} />
        </View>
        <Text style={styles.note}>
          You sign in with a one-time code sent to your mobile number, so there is no password to change or reset.
          The security settings above apply to this phone.
        </Text>
                <Text style={styles.note}>
          You sign in with a one-time code sent to your mobile number, so there is no password to change or reset.
          The security settings above apply to this phone.
        </Text>

        <Text style={styles.section}>SIGN-IN OPTIONS</Text>
        <LinkedAccountsCard />

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} activeOpacity={0.85}>
            
        </TouchableOpacity>
        <TouchableOpacity style={styles.logout} onPress={confirmLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[typography.bodyBold, { color: colors.error, marginLeft: spacing.sm }]}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  section: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs, letterSpacing: 0.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 20 + spacing.md },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl },
});