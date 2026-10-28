import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isPreBookedNow } from '../../context/AdminContext';
import ResidentAvatar from '../../components/common/ResidentAvatar';

export default function AdminPreBookingListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { residents, rooms, properties, activeProperty } = useAdmin();
  const propertyId: string | undefined = route.params?.propertyId ?? activeProperty?.id;

  const property = properties.find((p) => p.id === propertyId);

  // Pre-booked residents of this property (marked Pre-booking, joining date still ahead),
  // soonest joiner first.
  const upcoming = useMemo(() => {
    // Joining dates are stored as "25 Sep 2026".
    const M = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const t = (s: string) => {
      const m = (s || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
      const mi = m ? M.indexOf(m[2].toLowerCase()) : -1;
      return m && mi !== -1 ? new Date(Number(m[3]), mi, Number(m[1])).getTime() : 0;
    };
    return residents
      .filter((r) => r.propertyId === propertyId && isPreBookedNow(r))
      .sort((a, b) => t(a.joiningDate) - t(b.joiningDate));
  }, [residents, propertyId]);

  const floorOf = (roomId: string): number | null => {
    const f = rooms.find((r) => r.id === roomId)?.floor;
    return f === undefined ? null : f;
  };
  const floors = Array.from(new Set(upcoming.map((r) => floorOf(r.roomId)))).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>
          {property?.name ? `${property.name} · Pre-Bookings` : 'Pre-Bookings'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          {upcoming.length} pre-booking{upcoming.length !== 1 ? 's' : ''}
        </Text>

        {upcoming.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No pre-bookings for this property.
          </Text>
        ) : (
          floors.map((floor) => (
            <View key={String(floor)} style={styles.floorSection}>
              <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
                {floor === null ? 'No room assigned' : `Floor ${floor}`}
              </Text>
              {upcoming
                .filter((r) => floorOf(r.roomId) === floor)
                .map((resident) => {
                  const room = rooms.find((rm) => rm.id === resident.roomId);
                  const adv = resident.advanceDepositStatus;
                  return (
                    <TouchableOpacity
                      key={resident.id}
                      style={styles.card}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('AdminResidentDetail', { residentId: resident.id })}
                    >
                      <View style={styles.avatarWrap}>
                        <ResidentAvatar uri={resident.profileImageUri} name={resident.name} size={40} />
                      </View>
                      <View style={styles.content}>
                        <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {room ? `Room ${room.roomNumber} (${room.capacity} Sharing)` : 'No room'}
                          {resident.bedNumber ? ` · Bed ${resident.bedNumber}` : ''}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          Joining {resident.joiningDate} · ₹{(resident.monthlyRent || 0).toLocaleString()}/month
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: adv === 'Paid' ? '#D1FAE5' : '#FEF3C7' },
                          ]}
                        >
                          <Text
                            style={[
                              typography.caption,
                              { color: adv === 'Paid' ? colors.success : colors.warning, fontWeight: '700' },
                            ]}
                          >
                            {adv === 'Paid' ? 'Advance Paid' : adv === 'Not Paid' ? 'Advance Pending' : 'No Advance'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 6 }} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))
        )}
      </ScrollView>
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
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  floorSection: { marginBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrap: { marginRight: spacing.sm },
  content: { flex: 1 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
});