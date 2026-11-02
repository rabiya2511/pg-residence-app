import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useAppSettings } from '../../utils/appSettings';

const TIMEOUTS = [
  { label: 'Never', minutes: 0 },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
];

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { residentId, logout } = useMockAuth() as any;
  const { residents } = useAdmin();
  const { settings, update } = useAppSettings();

  const me: any = residents.find((r) => r.id === residentId);

  const toggleRent = (on: boolean) => {
    update({ rentReminders: on });
    // Turning it off clears reminders already scheduled; turning it on schedules again on the next app start.
    if (!on) Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    else Alert.alert('Rent reminders on', 'Your reminder will be scheduled the next time you open the app.');
  };

  const confirmLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to log out?', [
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
        <Text style={[typography.heading3, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>ACCOUNT</Text>
        <View style={styles.card}>
          <Row icon="person-outline" title={me?.name ?? 'Resident'} sub={me?.phone ? `Signed in with +91 ${String(me.phone).slice(-10)}` : 'Signed in with your phone number'} />
          <View style={styles.divider} />
          <Row icon="create-outline" title="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
        </View>

        <Text style={styles.section}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <Row
            icon="alarm-outline"
            title="Rent payment reminders"
            sub="A reminder before your rent due date"
            right={<Switch value={settings.rentReminders} onValueChange={toggleRent} trackColor={{ true: colors.primary }} />}
          />
        </View>
        <Text style={styles.note}>Notices, complaint and visitor updates appear inside the app. Push alerts for them are not available yet.</Text>

        <Text style={styles.section}>SECURITY</Text>
        <View style={[styles.card, { padding: spacing.md }]}>
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
        </Text>

        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.card}>
          <Row icon="lock-closed-outline" title="Privacy policy" onPress={() => navigation.navigate('Privacy')} />
          <View style={styles.divider} />
          <Row icon="help-circle-outline" title="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
        </View>

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