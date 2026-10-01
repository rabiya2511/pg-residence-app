import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isDailyGuestActiveNow } from '../../context/AdminContext';
import { MONTHLY_RENT_BY_CAPACITY } from '../../constants/mockData';

// Route names used by the buttons on this screen. Change them here if your
// navigator registers these screens under different names.
const ROOM_FORM_ROUTE = 'AdminRoomForm';
const RESIDENT_FORM_ROUTE = 'AdminResidentForm';
const RESIDENT_DETAIL_ROUTE = 'AdminResidentDetail';

type FilterKey = 'all' | 'available' | 'exit' | 'full' | 'vacant';

type Bed = {
  number: number;
  occupantName: string | null;
  kind: 'resident' | 'guest' | null;
  residentId?: string;
  vacating: boolean;
};

type RoomRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  floor: number;
  roomNumber: string;
  capacity: number;
  rent: number | null;
  beds: Bed[];
  occupied: number;
  vacant: number;
  status: 'Full' | 'Partial' | 'Vacant';
  hasExit: boolean;
};

export default function RoomManagementScreen() {
  const navigation = useNavigation<any>();
  const { rooms, residents, dailyGuests, properties } = useAdmin();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  // Start on the first property so identical room numbers from different
  // properties (e.g. Room 101 in both PGs) are never mixed together.
  const [propertyFilter, setPropertyFilter] = useState<string | 'all'>(() => properties[0]?.id ?? 'all');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  const allRoomRows: RoomRow[] = useMemo(() => {
    const rows: RoomRow[] = rooms.map((room) => {
      const roomResidents = residents.filter((r) => r.roomId === room.id);
      const roomGuests = dailyGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g));

      const occupiedBeds: Bed[] = [
        ...roomResidents.map((r) => ({
          number: 0,
          occupantName: r.name,
          kind: 'resident' as const,
          residentId: r.id,
          vacating: !!r.vacatingDate,
        })),
        ...roomGuests.map((g) => ({
          number: 0,
          occupantName: `${g.name} (Day Guest)`,
          kind: 'guest' as const,
          vacating: false,
        })),
      ];

      const totalSlots = Math.max(room.capacity, occupiedBeds.length);
      const beds: Bed[] = [];
      for (let i = 0; i < totalSlots; i++) {
        const occ = occupiedBeds[i];
        beds.push(
          occ
            ? { ...occ, number: i + 1 }
            : { number: i + 1, occupantName: null, kind: null, vacating: false }
        );
      }

      const occupied = Math.min(room.capacity, occupiedBeds.length);
      const vacant = Math.max(0, room.capacity - occupied);
      const status: RoomRow['status'] =
        occupied === 0 ? 'Vacant' : occupied >= room.capacity ? 'Full' : 'Partial';

      return {
        id: room.id,
        propertyId: room.propertyId,
        propertyName: properties.find((p) => p.id === room.propertyId)?.name ?? 'Property',
        floor: room.floor,
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        rent: MONTHLY_RENT_BY_CAPACITY[room.capacity] ?? null,
        beds,
        occupied,
        vacant,
        status,
        hasExit: beds.some((b) => b.vacating),
      };
    });

    // Safety net: if the same room number exists twice inside one property
    // (e.g. rooms generated twice), show it once — keeping the copy that
    // actually has people in it. Rooms with the same number in DIFFERENT
    // properties are real and are all kept.
    const byKey = new Map<string, RoomRow>();
    rows.forEach((row) => {
      const key = `${row.propertyId}|${row.roomNumber}`;
      const current = byKey.get(key);
      if (!current || row.occupied > current.occupied) byKey.set(key, row);
    });
    return Array.from(byKey.values());
  }, [rooms, residents, dailyGuests, properties]);

  // Rooms of the selected property only (or all properties). Everything below
  // — summary, floors, filters — is computed from this, so numbers always match
  // what is on screen.
  const roomRows = useMemo(
    () =>
      propertyFilter === 'all'
        ? allRoomRows
        : allRoomRows.filter((r) => r.propertyId === propertyFilter),
    [allRoomRows, propertyFilter]
  );

  const summary = useMemo(() => {
    const totalBeds = roomRows.reduce((s, r) => s + r.capacity, 0);
    const occupiedBeds = roomRows.reduce((s, r) => s + r.occupied, 0);
    return {
      totalRooms: roomRows.length,
      totalBeds,
      occupiedBeds,
      openBeds: totalBeds - occupiedBeds,
      percent: totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100),
      full: roomRows.filter((r) => r.status === 'Full').length,
      partial: roomRows.filter((r) => r.status === 'Partial').length,
      vacant: roomRows.filter((r) => r.status === 'Vacant').length,
      exitCount: roomRows.reduce((s, r) => s + r.beds.filter((b) => b.vacating).length, 0),
    };
  }, [roomRows]);

  const floors = useMemo(
    () => Array.from(new Set(roomRows.map((r) => r.floor))).sort((a, b) => a - b),
    [roomRows]
  );

  const filterCounts = {
    all: roomRows.length,
    available: summary.openBeds,
    exit: roomRows.filter((r) => r.hasExit).length,
    full: summary.full,
    vacant: summary.vacant,
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roomRows.filter((r) => {
      if (floorFilter !== 'all' && r.floor !== floorFilter) return false;
      if (filter === 'available' && r.vacant === 0) return false;
      if (filter === 'exit' && !r.hasExit) return false;
      if (filter === 'full' && r.status !== 'Full') return false;
      if (filter === 'vacant' && r.status !== 'Vacant') return false;
      if (q) {
        const matchesRoom = r.roomNumber.toLowerCase().includes(q);
        const matchesResident = r.beds.some((b) => b.occupantName?.toLowerCase().includes(q));
        if (!matchesRoom && !matchesResident) return false;
      }
      return true;
    });
  }, [roomRows, search, filter, floorFilter]);

  const groupedByFloor = useMemo(() => {
    const map = new Map<number, RoomRow[]>();
    filteredRows.forEach((r) => {
      map.set(r.floor, [...(map.get(r.floor) ?? []), r]);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, list]) => ({
        floor,
        rooms: list.sort(
          (a, b) =>
            a.propertyName.localeCompare(b.propertyName) ||
            a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
        ),
      }));
  }, [filteredRows]);

  const statusColor = (status: RoomRow['status']) =>
    status === 'Full' ? colors.success : status === 'Partial' ? colors.warning : colors.error;

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `All Rooms (${filterCounts.all})` },
    { key: 'available', label: `Available Beds (${filterCounts.available})` },
    { key: 'exit', label: `Exit / Notices (${filterCounts.exit})` },
    { key: 'full', label: `Fully Occupied (${filterCounts.full})` },
    { key: 'vacant', label: `Vacant Rooms (${filterCounts.vacant})` },
  ];

  const goAddRoom = () => navigation.navigate(ROOM_FORM_ROUTE);
  const goEditRoom = (room: RoomRow) =>
    navigation.navigate(ROOM_FORM_ROUTE, { roomId: room.id, propertyId: room.propertyId });
  const goAssign = (room: RoomRow) =>
    navigation.navigate(RESIDENT_FORM_ROUTE, { roomId: room.id, propertyId: room.propertyId });
  const goResident = (residentId?: string) => {
    if (residentId) navigation.navigate(RESIDENT_DETAIL_ROUTE, { residentId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading2, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
          Room & Bed Management
        </Text>
        <TouchableOpacity onPress={goAddRoom} style={styles.headerButton}>
          <Ionicons name="add" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Availability dashboard */}
        <View style={styles.card}>
          <View style={styles.dashTop}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.warning}20` }]}>
              <Ionicons name="bed-outline" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>Room & Availability Dashboard</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Live beds & exit pipeline</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: `${colors.warning}20` }]}>
              <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                {summary.openBeds} Beds Open
              </Text>
            </View>
          </View>

          <View style={styles.occupancyRow}>
            <Text style={[typography.heading2, { color: colors.text }]}>
              {summary.percent}% <Text style={[typography.caption, { color: colors.textMuted }]}>Occupied</Text>
            </Text>
            <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
              {summary.occupiedBeds} / {summary.totalBeds} Total Beds
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${summary.percent}%` }]} />
          </View>

          <View style={styles.tilesRow}>
            <SummaryTile label="Total Rooms" value={summary.totalRooms} color={colors.text} />
            <SummaryTile label="Full" value={summary.full} color={colors.success} />
            <SummaryTile label="Partial" value={summary.partial} color={colors.warning} />
            <SummaryTile label="Vacant" value={summary.vacant} color={colors.error} />
          </View>

          <View style={styles.exitBox}>
            <Ionicons name="exit-outline" size={18} color={colors.success} />
            <Text style={[typography.bodyBold, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              Exit Count
            </Text>
            <Text style={[typography.heading3, { color: colors.text }]}>{summary.exitCount}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.warning} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search room no. or resident name..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Property chips (only when the admin has more than one property) */}
        {properties.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {properties.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                small
                active={propertyFilter === p.id}
                onPress={() => {
                  setPropertyFilter(p.id);
                  setFloorFilter('all');
                }}
              />
            ))}
            <Chip
              label="All Properties"
              small
              active={propertyFilter === 'all'}
              onPress={() => {
                setPropertyFilter('all');
                setFloorFilter('all');
              }}
            />
          </ScrollView>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {filterChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              active={filter === chip.key}
              onPress={() => setFilter(chip.key)}
            />
          ))}
        </ScrollView>

        {/* Floor chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <Chip label="All Floors" small active={floorFilter === 'all'} onPress={() => setFloorFilter('all')} />
          {floors.map((f) => (
            <Chip
              key={f}
              label={`Floor ${f}`}
              small
              active={floorFilter === f}
              onPress={() => setFloorFilter(f)}
            />
          ))}
        </ScrollView>

        {/* Rooms grouped by floor */}
        {groupedByFloor.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="bed-outline" size={32} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {rooms.length === 0 ? 'No rooms yet. Tap Add Room to create one.' : 'No rooms match your filters.'}
            </Text>
          </View>
        )}

        {groupedByFloor.map((group) => {
          const openBeds = group.rooms.reduce((s, r) => s + r.vacant, 0);
          return (
            <View key={group.floor} style={{ marginTop: spacing.md }}>
              <View style={styles.floorHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>
                  Floor {group.floor} ({group.rooms.length} {group.rooms.length === 1 ? 'Room' : 'Rooms'})
                </Text>
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                  {openBeds} beds open
                </Text>
              </View>

              {group.rooms.map((room) => {
                const expanded = expandedRoomId === room.id;
                const sColor = statusColor(room.status);
                return (
                  <View key={room.id} style={[styles.card, { marginBottom: spacing.sm }]}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setExpandedRoomId(expanded ? null : room.id)}
                    >
                      <View style={styles.roomTop}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[typography.heading3, { color: colors.text }]}>Room {room.roomNumber}</Text>
                            <View style={styles.floorTag}>
                              <Text style={[typography.caption, { color: colors.textMuted }]}>Floor {room.floor}</Text>
                            </View>
                          </View>
                          <Text style={[typography.caption, { color: colors.warning, marginTop: 2 }]}>
                            {properties.length > 1 ? `${room.propertyName} · ` : ''}
                            {room.capacity} Sharing
                            {room.rent !== null ? ` · ₹${room.rent.toLocaleString()}/bed` : ''}
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: `${sColor}20` }]}>
                          <Text style={[typography.caption, { color: sColor, fontWeight: '700' }]}>
                            {room.status} ({room.occupied}/{room.capacity})
                          </Text>
                        </View>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.textMuted}
                          style={{ marginLeft: spacing.sm }}
                        />
                      </View>
                    </TouchableOpacity>

                    {expanded && (
                      <View style={{ marginTop: spacing.md }}>
                        <Text style={[typography.bodyBold, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                          Bed Assignments
                        </Text>

                        {room.beds.map((bed) => (
                          <View key={bed.number} style={styles.bedRow}>
                            <Ionicons
                              name="bed-outline"
                              size={18}
                              color={bed.occupantName ? colors.success : colors.error}
                            />
                            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                              <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                                Bed {bed.number}: {bed.occupantName ?? 'Vacant Bed'}
                              </Text>
                              {bed.vacating && (
                                <Text style={[typography.caption, { color: colors.error }]}>Vacating soon</Text>
                              )}
                            </View>
                            {bed.occupantName ? (
                              bed.kind === 'resident' && (
                                <TouchableOpacity
                                  style={styles.smallButton}
                                  onPress={() => goResident(bed.residentId)}
                                >
                                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                                    View
                                  </Text>
                                </TouchableOpacity>
                              )
                            ) : (
                              <TouchableOpacity
                                style={[styles.smallButton, { borderColor: colors.warning }]}
                                onPress={() => goAssign(room)}
                              >
                                <Ionicons name="add" size={14} color={colors.warning} />
                                <Text style={[typography.caption, { color: colors.warning, fontWeight: '600' }]}>
                                  Assign
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}

                        <TouchableOpacity style={styles.editRoomButton} onPress={() => goEditRoom(room)}>
                          <Ionicons name="create-outline" size={16} color={colors.text} />
                          <Text style={[typography.bodyBold, { color: colors.text, marginLeft: 6 }]}>Edit Room</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Floating Add Room button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={goAddRoom}>
        <Ionicons name="add" size={22} color={colors.white} />
        <Text style={[typography.bodyBold, { color: colors.white, marginLeft: 6 }]}>Add Room</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[typography.heading3, { color }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  small,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.chip,
        small && styles.chipSmall,
        active && { backgroundColor: colors.warning, borderColor: colors.warning },
      ]}
    >
      <Text
        style={[
          typography.caption,
          { color: active ? colors.white : colors.text, fontWeight: '600' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButton: { padding: spacing.xs },
  scrollContent: { padding: spacing.md, paddingBottom: 110 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dashTop: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  occupancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.warning,
  },
  tilesRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
    color: colors.text,
  },
  chipScroll: { marginTop: spacing.sm, flexGrow: 0 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipSmall: { paddingVertical: 6, paddingHorizontal: spacing.sm },
  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roomTop: { flexDirection: 'row', alignItems: 'center' },
  floorTag: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});