import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { AdminDailyGuest } from '../../constants/mockData';
import { guestCollected, isTodayRevenueGuest } from '../../utils/dayRevenue';
import ResidentAvatar from '../../components/common/ResidentAvatar';

function GuestRow({ guest, onPress }: { guest: AdminDailyGuest; onPress: () => void }) {
  const paid = guest.paymentStatus === 'Paid';
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={{ marginRight: spacing.sm }}>
        <ResidentAvatar uri={guest.profileImageUri} name={guest.name} size={40} />
      </View>
      <View style={styles.content}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{guest.name}</Text>
        <Text style={[typography.caption, { color: paid ? colors.success : colors.warning }]}>
          {guest.paymentStatus}
        </Text>
      </View>
      <Text style={[typography.bodyBold, { color: colors.success }]}>
        ₹{guestCollected(guest).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminDayRevenueScreen() {
  const navigation = useNavigation<any>();
  const { dailyGuests, clearDayRevenue, restoreDayRevenue } = useAdmin();

  // Only today's records. Earlier days are closed automatically.
  const todaysGuests = dailyGuests
    .filter(isTodayRevenueGuest)
    .sort((a, b) => b.checkInTimestamp - a.checkInTimestamp);
  const todayTotal = todaysGuests.reduce((sum, g) => sum + guestCollected(g), 0);
  const todayLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleClearAll = () => {
    Alert.alert(
      'Clear Day Revenue',
      "This removes today's records from this Day Revenue screen. Guest records are not deleted, and you can restore them any time.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Cleared',
          onPress: async () => {
            const res = await restoreDayRevenue();
            if (!res.ok) Alert.alert('Could Not Restore', res.message ?? 'Please try again.');
            else Alert.alert('Restored', res.count > 0 ? 'The cleared records are back.' : 'Nothing was cleared.');
          },
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const res = await clearDayRevenue();
            if (!res.ok) Alert.alert('Could Not Clear', res.message ?? 'Please try again.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Day Revenue</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.backButton}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={[typography.caption, { color: colors.white, opacity: 0.85 }]}>
          Today's Day-Guest Revenue · {todayLabel}
        </Text>
        <Text style={[typography.heading1, { color: colors.white, marginTop: 4 }]}>
          ₹{todayTotal.toLocaleString()}
        </Text>
        <Text style={[typography.caption, { color: colors.white, opacity: 0.85, marginTop: 4 }]}>
          {todaysGuests.length} guest{todaysGuests.length !== 1 ? 's' : ''} today · earlier days are closed automatically
        </Text>
      </View>

      <FlatList
        data={todaysGuests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No day-guest revenue today.
          </Text>
        }
        renderItem={({ item }) => (
          <GuestRow guest={item} onPress={() => navigation.navigate('AdminDailyGuestReceipt', { guestId: item.id })} />
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