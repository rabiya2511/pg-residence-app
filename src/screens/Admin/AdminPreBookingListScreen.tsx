import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

export default function AdminPreBookingListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId } = route.params;
  const { dailyGuests, rooms, properties } = useAdmin();

  const property = properties.find((p) => p.id === propertyId);
  const upcomingGuests = dailyGuests.filter(
    (g) => g.propertyId === propertyId && g.checkInTimestamp > Date.now()
  );

  const floors = Array.from(
    new Set(
      upcomingGuests
        .map((g) => rooms.find((r) => r.id === g.roomId)?.floor)
        .filter((f): f is number => f !== undefined)
    )
  ).sort((a, b) => a - b);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>
          {property?.name ?? 'Pre-Bookings'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {upcomingGuests.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No upcoming bookings for this property.
          </Text>
        ) : (
          floors.map((floor) => (
            <View key={floor} style={styles.floorSection}>
              <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
                Floor {floor}
              </Text>
              {upcomingGuests
                .filter((g) => rooms.find((r) => r.id === g.roomId)?.floor === floor)
                .map((guest) => {
                  const room = rooms.find((r) => r.id === guest.roomId);
                  return (
                    <TouchableOpacity
                      key={guest.id}
                      style={styles.card}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('AdminDailyGuestReceipt', { guestId: guest.id })}
                    >
                      <View style={styles.avatarWrap}>
                        <Ionicons name="person" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.content}>
                        <Text style={[typography.bodyBold, { color: colors.text }]}>{guest.name}</Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          Room {room?.roomNumber} ({room?.capacity} Sharing)
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          Checking in {guest.checkInDate} · {guest.numDays} day{guest.numDays > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
});