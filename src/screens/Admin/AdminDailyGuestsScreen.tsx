import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { properties, AdminDailyGuest } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

function GuestCard({ guest, onPress, roomNumber }: { guest: AdminDailyGuest; onPress: () => void; roomNumber: string | undefined }) {
  const property = properties.find((p) => p.id === guest.propertyId);
  const isUpcoming = guest.checkInTimestamp > Date.now();
  const nameColor = guest.paymentStatus === 'Paid' ? colors.success : colors.error;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.avatarWrap}>
        <Ionicons name="person" size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Text style={[typography.bodyBold, { color: nameColor }]}>{guest.name}</Text>
          {isUpcoming && (
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[typography.caption, { color: colors.primary }]}>Upcoming</Text>
            </View>
          )}
          <View
            style={[
              styles.badge,
              { backgroundColor: guest.paymentStatus === 'Paid' ? '#D1FAE5' : '#FEF3C7' },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: guest.paymentStatus === 'Paid' ? colors.success : colors.warning },
              ]}
            >
              {guest.paymentStatus}
            </Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {property?.name} · Room {roomNumber}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {guest.numDays} day{guest.numDays > 1 ? 's' : ''} · {isUpcoming ? 'Checking in' : 'Checked in'} {guest.checkInDate}
        </Text>
      </View>
      <Text style={[typography.bodyBold, { color: colors.primary }]}>
        ₹{guest.totalAmount.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminDailyGuestsScreen() {
  const navigation = useNavigation<any>();
  const { dailyGuests, rooms } = useAdmin();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[typography.heading2, { color: colors.text }]}>Day Guests</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{dailyGuests.length} total</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.preBookingButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminPreBookingProperties')}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminDailyGuestForm')}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={dailyGuests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No day guests yet. Tap + to add one.
          </Text>
        }
        renderItem={({ item }) => (
          <GuestCard
            guest={item}
            roomNumber={rooms.find((r) => r.id === item.roomId)?.roomNumber}
            onPress={() => navigation.navigate('AdminDailyGuestReceipt', { guestId: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preBookingButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
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
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
});