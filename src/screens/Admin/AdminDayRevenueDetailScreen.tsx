import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { properties, initialRooms as rooms, AdminDailyGuest } from '../../constants/mockData';

function collectedAmount(guest: AdminDailyGuest): number {
  return guest.paymentStatus === 'Paid' ? guest.totalAmount : guest.advanceAmount ?? 0;
}

function GuestRow({ guest, onPress }: { guest: AdminDailyGuest; onPress: () => void }) {
  const property = properties.find((p) => p.id === guest.propertyId);
  const room = rooms.find((r) => r.id === guest.roomId);
  const collected = collectedAmount(guest);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.avatarWrap}>
        <Ionicons name="person" size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{guest.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {property?.name} · Room {room?.roomNumber}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: guest.paymentStatus === 'Paid' ? '#D1FAE5' : '#FEF3C7', alignSelf: 'flex-start', marginTop: 4 },
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
      <Text style={[typography.bodyBold, { color: colors.success }]}>
        ₹{collected.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminDayRevenueDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { date } = route.params;
  const { dailyGuests } = useAdmin();

  const guestsForDay = dailyGuests.filter((g) => g.checkInDate === date);
  const total = guestsForDay.reduce((sum, g) => sum + collectedAmount(g), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>{date}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.summaryRow}>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {guestsForDay.length} guest{guestsForDay.length !== 1 ? 's' : ''}
        </Text>
        <Text style={[typography.heading3, { color: colors.success }]}>₹{total.toLocaleString()}</Text>
      </View>

      <FlatList
        data={guestsForDay}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <GuestRow
            guest={item}
            onPress={() => navigation.navigate('AdminDailyGuestReceipt', { guestId: item.id })}
          />
        )}
      />
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
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
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
});