import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { MONTHLY_RENT_BY_CAPACITY, DAILY_GUEST_RATE } from '../../constants/mockData';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';

type StayType = 'Monthly' | 'DayGuest';

export default function BookRoomScreen() {
  const navigation = useNavigation<any>();
  const { publicProperties, residents, rooms, dailyGuests } = useAdmin();

  const [stayType, setStayType] = useState<StayType>('Monthly');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  const selectedProperty = publicProperties.find((p) => p.id === selectedPropertyId);

  const floorsForProperty = selectedPropertyId
    ? Array.from(new Set(rooms.filter((r) => r.propertyId === selectedPropertyId).map((r) => r.floor))).sort(
        (a, b) => a - b
      )
    : [];

  // Same availability math as the admin screens, so residents see exactly
  // what admin sees — no separate/optimistic view of occupancy. Includes
  // currently-active day guests, not just monthly residents.
  const roomsWithAvailability =
    selectedPropertyId && selectedFloor !== null
      ? rooms
          .filter((r) => r.propertyId === selectedPropertyId && r.floor === selectedFloor)
          .map((r) => {
            const residentOccupants = residents.filter((res) => res.roomId === r.id).length;
            const activeGuestOccupants = dailyGuests.filter(
              (g) => g.roomId === r.id && isDailyGuestActiveNow(g)
            ).length;
            const occupants = residentOccupants + activeGuestOccupants;
            const remaining = r.capacity - occupants;
            return { ...r, occupants, remaining };
          })
      : [];

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    setSelectedFloor(null);
  };

  const handleSelectRoom = (roomId: string) => {
    if (!selectedPropertyId) return;
    navigation.navigate('BookRoomForm', {
      propertyId: selectedPropertyId,
      roomId,
      stayType,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {selectedPropertyId ? (
          <TouchableOpacity
            onPress={() => (selectedFloor !== null ? setSelectedFloor(null) : setSelectedPropertyId(null))}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>
          {selectedFloor !== null
            ? `Floor ${selectedFloor}`
            : selectedProperty
            ? selectedProperty.name
            : 'Book a Room'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Stay type toggle, always visible at the top of the flow */}
      <View style={styles.stayTypeRow}>
        {(['Monthly', 'DayGuest'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.stayTypeButton, stayType === type && styles.stayTypeButtonActive]}
            onPress={() => setStayType(type)}
          >
            <Text
              style={[
                typography.body,
                { color: stayType === type ? colors.white : colors.text, fontWeight: '600' },
              ]}
            >
              {type === 'Monthly' ? 'Monthly Stay' : 'Day Guest'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* STEP 1: choose property, with photos uploaded by admin. Only the
            primary PG owner's properties are shown here — test/dynamically
            created admin accounts never appear in this public booking flow. */}
        {!selectedPropertyId && (
          <>
            {publicProperties.map((property) => {
              const coverImage = property.images[0];
              return (
                <TouchableOpacity
                  key={property.id}
                  style={styles.propertyCard}
                  activeOpacity={0.85}
                  onPress={() => handleSelectProperty(property.id)}
                >
                  {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.propertyImage} />
                  ) : (
                    <View style={[styles.propertyImage, styles.propertyImagePlaceholder]}>
                      <Ionicons name="business-outline" size={32} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.propertyOverlay}>
                    <Text style={[typography.heading3, { color: colors.white }]}>{property.name}</Text>
                    <Text style={[typography.caption, { color: colors.white }]}>
                      {property.images.length} photo{property.images.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {publicProperties.length === 0 && (
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
                No properties available yet.
              </Text>
            )}
          </>
        )}

        {/* STEP 2: choose floor */}
        {selectedPropertyId && selectedFloor === null && (
          <View style={styles.floorGrid}>
            {floorsForProperty.map((floor) => (
              <TouchableOpacity
                key={floor}
                style={styles.floorCard}
                activeOpacity={0.85}
                onPress={() => setSelectedFloor(floor)}
              >
                <Ionicons name="layers-outline" size={22} color={colors.primary} />
                <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.xs }]}>
                  Floor {floor}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 3: choose an available room/bed on that floor */}
        {selectedPropertyId && selectedFloor !== null && (
          <>
            {roomsWithAvailability.map((room) => {
              const isFull = room.remaining <= 0;
              const rate =
                stayType === 'Monthly'
                  ? MONTHLY_RENT_BY_CAPACITY[room.capacity] ?? 8500
                  : DAILY_GUEST_RATE;

              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.roomCard, isFull && styles.roomCardDisabled]}
                  activeOpacity={isFull ? 1 : 0.8}
                  disabled={isFull}
                  onPress={() => handleSelectRoom(room.id)}
                >
                  <View style={styles.roomIconWrap}>
                    <Ionicons name="bed-outline" size={22} color={isFull ? colors.textMuted : colors.primary} />
                  </View>
                  <View style={styles.content}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>
                      {room.roomNumber} · {room.capacity} Sharing
                    </Text>
                    <Text style={[typography.caption, { color: isFull ? colors.error : colors.success }]}>
                      {isFull ? 'Full — no beds left' : `${room.remaining} bed${room.remaining !== 1 ? 's' : ''} available`}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {stayType === 'Monthly' ? `₹${rate.toLocaleString()}/month` : `₹${rate}/day`}
                    </Text>
                  </View>
                  {!isFull && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                </TouchableOpacity>
              );
            })}
            {roomsWithAvailability.length === 0 && (
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
                No rooms on this floor.
              </Text>
            )}
          </>
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
  stayTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  stayTypeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  stayTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  propertyCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    height: 160,
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  propertyImagePlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  floorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  floorCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roomCardDisabled: {
    opacity: 0.5,
  },
  roomIconWrap: {
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