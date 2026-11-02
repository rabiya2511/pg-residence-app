import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useFacilities } from '../../hooks/useFacilities';

const ordinal = (n: number) => {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suffix}`;
};
const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodyBold, styles.rowValue]}>{value || '—'}</Text>
    </View>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
        <Text style={[typography.bodyBold, { color: colors.text, marginLeft: 8 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// Everything here is read-only: the admin controls room, rent and deposit records.
export default function StayDetailsScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, properties } = useAdmin();
  const { residentId } = useMockAuth();
  const { data: facilities } = useFacilities();

  const resident: any = residents.find((r) => r.id === residentId);
  const room: any = resident ? rooms.find((r) => r.id === resident.roomId) : undefined;
  const property: any = resident ? properties.find((p) => p.id === resident.propertyId) : undefined;

  const phone: string = (property?.contactPhone ?? '').replace(/[^\d+]/g, '');
  const address: string = property?.address ?? '';

  const call = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Cannot Call', 'No phone app is available.'));
  };
  const openMap = () => {
    const q = encodeURIComponent(`${property?.name ?? ''} ${address}`.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() =>
      Alert.alert('Cannot Open Maps', 'No maps app or browser is available.')
    );
  };

  const deposit = Number(resident?.securityDeposit) || 0;
  const advanceStatus: string = resident?.advanceDepositStatus ?? (deposit > 0 ? 'Paid' : 'No Advance');
  const onNotice = !!resident?.vacatingDate;
  const wifiRows: { floor: string; network: string; password: string }[] = (facilities?.wifi ?? []).filter(
    (w: any) => w.network || w.password
  );
  // Facility facts the admin published (hot water, power backup, ...); only the filled ones are shown.
  const facilityRows = [
    { label: 'Hot water', value: facilities?.hotWater },
    { label: 'Power backup', value: facilities?.powerBackup },
    { label: 'Generator', value: facilities?.generator },
    { label: 'Housekeeping', value: facilities?.housekeeping },
  ].filter((r) => !!(r.value ?? '').toString().trim());
  const hasFacilities = wifiRows.length > 0 || facilityRows.length > 0;
  const floor =
    room == null ? '' : room.floor === 0 ? 'Ground Floor' : `Floor ${room.floor}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Stay & Room Details</Text>
        <View style={{ width: 30 }} />
      </View>

      {!resident ? (
        <View style={styles.empty}>
          <Ionicons name="bed-outline" size={44} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Your stay details are not available yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card title="Property" icon="business-outline">
            <Row label="Name" value={property?.name} />
            <Row label="Address" value={address} />
            <Row label="Manager" value={property?.branchManager} />
            <Row label="Contact" value={property?.contactPhone} />
            <View style={styles.actions}>
              {!!phone && (
                <TouchableOpacity style={styles.actionBtn} onPress={call} activeOpacity={0.85}>
                  <Ionicons name="call" size={16} color={colors.white} />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
              )}
              {!!address && (
                <TouchableOpacity style={styles.actionBtn} onPress={openMap} activeOpacity={0.85}>
                  <Ionicons name="location" size={16} color={colors.white} />
                  <Text style={styles.actionText}>Open in Maps</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          <Card title="Room" icon="bed-outline">
            <Row label="Room number" value={room?.roomNumber} />
            <Row label="Floor" value={floor} />
            <Row label="Sharing" value={room ? `${room.capacity} Sharing` : ''} />
          </Card>

          <Card title="Stay" icon="calendar-outline">
            <Row label="Check-in date" value={resident.joiningDate} />
            <Row label="Stay status" value={onNotice ? 'Notice Given' : 'Active'} />
            <Row label="Agreement start" value={resident.joiningDate} />
            {onNotice && <Row label="Expected checkout" value={String(resident.vacatingDate)} />}
            {onNotice && !!resident.vacateReason && <Row label="Reason" value={resident.vacateReason} />}
          </Card>

          <Card title="Rent & Deposit" icon="wallet-outline">
            <Row label="Monthly rent" value={inr(resident.monthlyRent)} />
            {!!resident.maintenanceCharges && <Row label="Maintenance charges" value={inr(Number(resident.maintenanceCharges))} />}
            <Row label="Rent due day" value={resident.rentDueDay ? `${ordinal(Number(resident.rentDueDay))} of every month` : ''} />
            <Row label="Security deposit" value={deposit > 0 ? inr(deposit) : 'No advance'} />
            {deposit > 0 && <Row label="Deposit status" value={advanceStatus} />}
          </Card>

          {hasFacilities && (
            <Card title="Wi-Fi & Facilities" icon="wifi-outline">
              {wifiRows.map((w, i) => (
                <View key={i} style={styles.wifiBlock}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{w.floor || 'Wi-Fi'}</Text>
                  <Row label="Network" value={w.network} />
                  {!!w.password && <Row label="Password" value={w.password} />}
                </View>
              ))}
              {facilityRows.map((r) => (
                <Row key={r.label} label={r.label} value={String(r.value)} />
              ))}
              <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Facilities')} activeOpacity={0.7}>
                <Text style={[typography.bodyBold, { color: colors.primary }]}>All facilities & emergency contacts</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </Card>
          )}

          {!!property?.houseGuidelines && (
            <Card title="House Rules" icon="document-text-outline">
              <Text style={[typography.body, { color: colors.text }]}>{String(property.houseGuidelines)}</Text>
            </Card>
          )}

          <Text style={[typography.caption, styles.footnote]}>
            Room, rent and deposit are managed by the PG admin. Contact them for any correction.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowValue: { color: colors.text, flex: 1, textAlign: 'right', marginLeft: spacing.md },
  actions: { flexDirection: 'row', marginTop: spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginRight: spacing.sm,
  },
  actionText: { color: colors.white, fontWeight: '600', marginLeft: 6, fontSize: 13 },
  wifiBlock: { marginBottom: spacing.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  footnote: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});