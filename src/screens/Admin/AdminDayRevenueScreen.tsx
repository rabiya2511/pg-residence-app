import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { AdminDailyGuest } from '../../constants/mockData';

type DayGroup = {
  date: string;
  timestamp: number;
  total: number;
  guestCount: number;
};

function collectedAmount(guest: AdminDailyGuest): number {
  return guest.paymentStatus === 'Paid' ? guest.totalAmount : guest.advanceAmount ?? 0;
}

function DayCard({ group, onPress }: { group: DayGroup; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{group.date}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {group.guestCount} guest{group.guestCount > 1 ? 's' : ''} checked in
        </Text>
      </View>
      <Text style={[typography.bodyBold, { color: colors.success }]}>
        ₹{group.total.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminDayRevenueScreen() {
  const navigation = useNavigation<any>();
  const { dailyGuests } = useAdmin();

  const groupsMap = new Map<string, DayGroup>();
  for (const guest of dailyGuests) {
    const existing = groupsMap.get(guest.checkInDate);
    const collected = collectedAmount(guest);
    if (existing) {
      existing.total += collected;
      existing.guestCount += 1;
    } else {
      groupsMap.set(guest.checkInDate, {
        date: guest.checkInDate,
        timestamp: guest.checkInTimestamp,
        total: collected,
        guestCount: 1,
      });
    }
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  const overallTotal = groups.reduce((sum, g) => sum + g.total, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Day Revenue</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={[typography.caption, { color: colors.white, opacity: 0.85 }]}>
          Total Day-Guest Revenue
        </Text>
        <Text style={[typography.heading1, { color: colors.white, marginTop: 4 }]}>
          ₹{overallTotal.toLocaleString()}
        </Text>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No day-guest revenue yet.
          </Text>
        }
        renderItem={({ item }) => (
          <DayCard group={item} onPress={() => navigation.navigate('AdminDayRevenueDetail', { date: item.date })} />
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
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
});