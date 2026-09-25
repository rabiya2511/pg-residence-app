import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';

export default function AdminPropertyRoomsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId } = route.params;
  const { residents, rooms, properties, dailyGuests } = useAdmin();

  const property = properties.find((p) => p.id === propertyId);
  const propertyRooms = rooms.filter((r) => r.propertyId === propertyId);
  const floors = Array.from(new Set(propertyRooms.map((r) => r.floor))).sort((a, b) => a - b);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>
          {property?.name ?? 'Rooms'}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminRoomForm', { propertyId })}
          style={styles.backButton}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {floors.map((floor) => (
          <View key={floor} style={styles.floorSection}>
            <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
              Floor {floor}
            </Text>
            {propertyRooms
              .filter((r) => r.floor === floor)
              .map((room) => {
                const activeGuestsInRoom = dailyGuests.filter(
                  (g) => g.roomId === room.id && isDailyGuestActiveNow(g)
                );
                const occupantCount =
                  residents.filter((r) => r.roomId === room.id).length + activeGuestsInRoom.length;
                const remaining = room.capacity - occupantCount;
                const isFull = remaining <= 0;

                return (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.card}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('AdminRoomDetail', { roomId: room.id })}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons name="bed-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.content}>
                      <Text style={[typography.bodyBold, { color: colors.text }]}>{room.roomNumber}</Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                        {room.capacity} Sharing {isFull ? '(Full)' : `(${remaining} bed${remaining > 1 ? 's' : ''} remaining)`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: isFull ? '#FEE2E2' : '#D1FAE5' },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: isFull ? colors.error : colors.success },
                        ]}
                      >
                        {occupantCount}/{room.capacity}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        ))}

        {propertyRooms.length === 0 && (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No rooms yet. Tap + above to add the first one.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
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
  content: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  floorSection: {
    marginBottom: spacing.lg,
  },
});