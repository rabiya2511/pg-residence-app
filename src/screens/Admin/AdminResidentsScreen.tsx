import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident, Room, Property, MONTHLY_RENT_BY_CAPACITY } from '../../constants/mockData';
import { useAdmin, isDailyGuestActiveNow, isPreBookedNow, ArchivedResident } from '../../context/AdminContext';
import { exportResidentsToExcel } from '../../services/exportResidentsToExcel';
import ResidentAvatar from '../../components/common/ResidentAvatar';

const WHATSAPP_GREEN = '#25D366';
const AVATAR_ORANGE = '#F59E0B';
const PREBOOK_BG = '#EDE9FE';
const PREBOOK_TEXT = '#6D28D9';
const MONTHS_3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
};

type ViewMode = 'list' | 'rooms';
type Filter = 'active' | 'prebooked' | 'all' | 'archived' | 'male' | 'female' | 'vacating' | 'due';
type Entry = { resident: AdminResident | ArchivedResident; archived: boolean };

type Occupant = {
  key: string;
  kind: 'resident' | 'guest';
  name: string;
  phone: string;
  resident?: AdminResident;
};

// ───────────────────────── helpers ─────────────────────────

const getRoom = (rooms: Room[], roomId: string) => rooms.find((r) => r.id === roomId);
const getRoomNumber = (rooms: Room[], roomId: string) => getRoom(rooms, roomId)?.roomNumber ?? 'Unassigned';
const getPropertyName = (properties: Property[], propertyId: string) =>
  properties.find((p) => p.id === propertyId)?.name ?? 'Unknown Property';

const initialOf = (name: string) => (name?.trim().charAt(0) || '?').toUpperCase();

const isGender = (r: AdminResident, g: 'male' | 'female') => String((r as any).gender ?? '').toLowerCase() === g;

function parseDisplayDate(str: string | null | undefined): number {
  if (!str) return Number.MAX_SAFE_INTEGER;
  const m = str.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const idx = MONTHS_3.indexOf(m[2].toLowerCase());
  return idx === -1 ? Number.MAX_SAFE_INTEGER : new Date(Number(m[3]), idx, Number(m[1])).getTime();
}

function waDigits(phone: string): string {
  let d = (phone ?? '').replace(/[^\d]/g, '');
  if (d.length === 10) d = `91${d}`; // 10-digit Indian numbers
  return d;
}

function handleCall(phone: string) {
  Linking.openURL(`tel:${(phone ?? '').replace(/\s/g, '')}`).catch(() => {
    Alert.alert('Unable to Call', 'Could not open the dialer.');
  });
}

function handleWhatsApp(phone: string, text?: string) {
  const url = `https://wa.me/${waDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

// True when a rent reminder makes sense: rent is unpaid and the resident has actually joined.
const needsRentReminder = (r: AdminResident) => r.rentStatus !== 'Paid' && !isPreBookedNow(r);

// A reminder when rent is due, a plain chat otherwise (pre-booked residents just get a chat).
function messageResident(resident: AdminResident, roomNumber: string, properties: Property[]) {
  if (needsRentReminder(resident)) {
    const pg = getPropertyName(properties, resident.propertyId);
    handleWhatsApp(
      resident.phone,
      `Hi ${resident.name}, this is a reminder that your rent of ₹${resident.monthlyRent} (Room ${roomNumber}) is currently ${resident.rentStatus}. Please make the payment at your earliest convenience. — ${pg}`
    );
  } else {
    handleWhatsApp(resident.phone);
  }
}

// Places occupants into numbered beds. A stored bedNumber is honoured when there is one,
// everyone else fills the remaining beds in order of joining date.
function buildBeds(occupants: Occupant[], capacity: number): (Occupant | null)[] {
  const ordered = [...occupants].sort(
    (a, b) => parseDisplayDate(a.resident?.joiningDate) - parseDisplayDate(b.resident?.joiningDate)
  );
  const beds: (Occupant | null)[] = Array(Math.max(capacity, 0)).fill(null);
  const placed = new Set<string>();

  ordered.forEach((o) => {
    const n = Number((o.resident as any)?.bedNumber);
    if (n >= 1 && n <= beds.length && !beds[n - 1]) {
      beds[n - 1] = o;
      placed.add(o.key);
    }
  });
  ordered.forEach((o) => {
    if (placed.has(o.key)) return;
    const i = beds.findIndex((b) => !b);
    if (i >= 0) beds[i] = o;
    else beds.push(o); // more people than beds
  });
  return beds;
}

// ───────────────────────── list cards ─────────────────────────
function Avatar({ name, uri, muted }: { name: string; uri?: string | null; muted?: boolean }) {
  return (
    <View style={muted ? { opacity: 0.5 } : undefined}>
      <ResidentAvatar uri={uri} name={name} size={40} />
    </View>
  );
}

function ResidentCard({
  resident,
  rooms,
  properties,
  onPress,
  onMenu,
}: {
  resident: AdminResident;
  rooms: Room[];
  properties: Property[];
  onPress: () => void;
  onMenu: () => void;
}) {
  const room = getRoom(rooms, resident.roomId);
  const roomNumber = room?.roomNumber ?? 'Unassigned';
  const rent = statusColors[resident.rentStatus] ?? statusColors.Pending;
  const vacating = !!resident.vacatingDate;
  const preBooked = isPreBookedNow(resident);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <Avatar name={resident.name} uri={resident.profileImageUri} />
      <View style={styles.cardBody}>
        <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
          {resident.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.roomTag}>
            <Text style={styles.roomTagText}>{room ? `R${roomNumber}` : 'N/A'}</Text>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
            {room ? `${room.capacity} Sharing` : 'No room'} ·{' '}
            {vacating
              ? `Vacating ${resident.vacatingDate}`
              : preBooked
              ? `Pre-booked · joins ${resident.joiningDate}`
              : 'Active'}
          </Text>
        </View>
        {preBooked ? (
          <View style={[styles.rentPill, { backgroundColor: PREBOOK_BG }]}>
            <Text style={[typography.caption, { color: PREBOOK_TEXT, fontWeight: '700' }]}>Pre-booked</Text>
          </View>
        ) : (
          <View style={[styles.rentPill, { backgroundColor: rent.bg }]}>
            <Text style={[typography.caption, { color: rent.text, fontWeight: '700' }]}>Rent {resident.rentStatus}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.roundIcon} onPress={() => handleCall(resident.phone)}>
        <Ionicons name="call" size={18} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.roundIcon} onPress={() => messageResident(resident, roomNumber, properties)}>
        <Ionicons name="chatbox-ellipses-outline" size={19} color={WHATSAPP_GREEN} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.roundIcon} onPress={onMenu} hitSlop={8}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ArchivedResidentCard({
  resident,
  rooms,
  properties,
  onRestore,
  onDeletePermanently,
}: {
  resident: ArchivedResident;
  rooms: Room[];
  properties: Property[];
  onRestore: () => void;
  onDeletePermanently: () => void;
}) {
  const roomNumber = getRoomNumber(rooms, resident.roomId);

  return (
    <View style={styles.archivedCard}>
      <View style={styles.archivedTop}>
        <Avatar name={resident.name} uri={resident.profileImageUri} muted />
        <View style={styles.cardBody}>
          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
            {resident.name}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            Last room: {roomNumber} · {getPropertyName(properties, resident.propertyId)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Archived on {resident.archivedOn}</Text>
        </View>
        <TouchableOpacity style={styles.roundIcon} onPress={() => handleCall(resident.phone)}>
          <Ionicons name="call" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundIcon} onPress={() => handleWhatsApp(resident.phone)}>
          <Ionicons name="chatbox-ellipses-outline" size={19} color={WHATSAPP_GREEN} />
        </TouchableOpacity>
      </View>
      <View style={styles.archivedActions}>
        <TouchableOpacity style={[styles.archivedButton, styles.restoreButton]} activeOpacity={0.85} onPress={onRestore}>
          <Ionicons name="refresh-outline" size={16} color={colors.white} />
          <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.archivedButton, styles.permDeleteButton]} activeOpacity={0.85} onPress={onDeletePermanently}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 6 }]}>Delete Permanently</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ───────────────────────── room-wise card ─────────────────────────

type RoomCardData = {
  room: Room;
  propertyName: string;
  rentPerBed: number | null;
  beds: (Occupant | null)[];
  occupied: number;
};

function RoomCard({
  data,
  showProperty,
  properties,
  onOpenResident,
  onAllot,
}: {
  data: RoomCardData;
  showProperty: boolean;
  properties: Property[];
  onOpenResident: (id: string) => void;
  onAllot: (room: Room) => void;
}) {
  const { room, beds, occupied, rentPerBed, propertyName } = data;
  const vacant = Math.max(0, room.capacity - occupied);
  const allVacant = occupied === 0;

  return (
    <View style={styles.roomCard}>
      <View style={styles.roomHeader}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeText}>ROOM {room.roomNumber}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
            Floor {room.floor} · {room.capacity} Sharing
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {rentPerBed != null ? `₹${rentPerBed.toLocaleString()} / bed` : 'Rent not set'}
            {showProperty ? ` · ${propertyName}` : ''}
          </Text>
        </View>
        <View style={[styles.vacancyPill, vacant === 0 && styles.fullPill]}>
          <Text style={[typography.caption, { color: vacant === 0 ? colors.success : '#B45309', fontWeight: '700' }]}>
            {vacant === 0 ? 'Full' : `${vacant} Bed${vacant === 1 ? '' : 's'} Vacant`}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>
        ASSIGNED RESIDENTS & BEDS ({occupied}/{room.capacity})
      </Text>

      {allVacant ? (
        <View style={styles.allVacantRow}>
          <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>
            All {room.capacity} beds currently vacant
          </Text>
          <TouchableOpacity onPress={() => onAllot(room)}>
            <Text style={[typography.bodyBold, { color: colors.primary }]}>+ Allot Room</Text>
          </TouchableOpacity>
        </View>
      ) : (
        beds.map((bed, i) =>
          bed ? (
            <TouchableOpacity
              key={bed.key}
              style={styles.bedRow}
              activeOpacity={bed.resident ? 0.8 : 1}
              onPress={() => bed.resident && onOpenResident(bed.resident.id)}
            >
              <View style={styles.bedTag}>
                <Text style={styles.bedTagText}>Bed {i + 1}</Text>
              </View>
              <Avatar name={bed.name} uri={bed.resident?.profileImageUri} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                  {bed.name}
                  {bed.kind === 'guest' ? '  · Day Guest' : ''}
                  {bed.resident && isPreBookedNow(bed.resident) ? '  · Pre-booked' : ''}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{bed.phone}</Text>
              </View>
              <TouchableOpacity style={styles.smallIcon} onPress={() => handleCall(bed.phone)}>
                <Ionicons name="call" size={17} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallIcon}
                onPress={() =>
                  bed.resident
                    ? messageResident(bed.resident, room.roomNumber, properties)
                    : handleWhatsApp(bed.phone)
                }
              >
                <Ionicons name="chatbox-ellipses-outline" size={18} color={WHATSAPP_GREEN} />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <View key={`vacant_${i}`} style={styles.vacantRow}>
              <View style={[styles.bedTag, styles.bedTagVacant]}>
                <Text style={[styles.bedTagText, { color: colors.success }]}>Bed {i + 1}</Text>
              </View>
              <Text style={[typography.bodyBold, { color: colors.success, flex: 1 }]}>✨ Vacant Bed Available</Text>
              <TouchableOpacity style={styles.allotButton} onPress={() => onAllot(room)}>
                <Ionicons name="person-add-outline" size={16} color={colors.success} />
                <Text style={[typography.caption, { color: colors.success, fontWeight: '700', marginLeft: 4 }]}>Allot</Text>
              </TouchableOpacity>
            </View>
          )
        )
      )}
    </View>
  );
}

// ───────────────────────── screen ─────────────────────────

export default function AdminResidentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const filterRentStatus: 'PendingOrOverdue' | undefined = route.params?.filterRentStatus;
  const {
    residents,
    archivedResidents,
    archiveResident,
    restoreResident,
    permanentlyDeleteResident,
    updateResident,
    transferResidentRoom,
    rooms,
    properties,
    dailyGuests,
    identityDocuments,
    paymentNotifications,
    vacateNotifications,
  } = useAdmin();

  const [mode, setMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [menuTarget, setMenuTarget] = useState<AdminResident | null>(null);
  // Restore dialog state
  const [restoreTarget, setRestoreTarget] = useState<ArchivedResident | null>(null);
  const [restoreRoomId, setRestoreRoomId] = useState<string | null>(null);
  const [restoreRent, setRestoreRent] = useState('');
  // Bed Replace dialog state
  const [bedTarget, setBedTarget] = useState<AdminResident | null>(null);
  const [bedRoomId, setBedRoomId] = useState<string | null>(null);
  const [bedNumber, setBedNumber] = useState<number | null>(null);

  const effectiveFilter: Filter = filterRentStatus ? 'due' : filter;

  const unreadCount =
    paymentNotifications.filter((n) => !n.read).length + vacateNotifications.filter((n) => !n.read).length;

  // ----- filter counts (pre-booked residents are not "active" until their joining date) -----
  const counts = {
    active: residents.filter((r) => !isPreBookedNow(r)).length,
    prebooked: residents.filter((r) => isPreBookedNow(r)).length,
    all: residents.length + archivedResidents.length,
    archived: archivedResidents.length,
    male: residents.filter((r) => isGender(r, 'male')).length,
    female: residents.filter((r) => isGender(r, 'female')).length,
    vacating: residents.filter((r) => !!r.vacatingDate).length,
    due: residents.filter((r) => r.rentStatus !== 'Paid' && !isPreBookedNow(r)).length,
  };

  const matchesSearch = (r: AdminResident, roomNumber: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      roomNumber.toLowerCase().includes(q) ||
      (r.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
      ((r as any).email ?? '').toLowerCase().includes(q)
    );
  };

  // Does an ACTIVE-list resident pass the selected chip?
  const passesFilter = (r: AdminResident) => {
    switch (effectiveFilter) {
      case 'active':
        return !isPreBookedNow(r);
      case 'prebooked':
        return isPreBookedNow(r);
      case 'male':
        return isGender(r, 'male');
      case 'female':
        return isGender(r, 'female');
      case 'vacating':
        return !!r.vacatingDate;
      case 'due':
        return r.rentStatus !== 'Paid' && !isPreBookedNow(r);
      default:
        return true;
    }
  };

  // ----- List View data -----
  const entries = useMemo<Entry[]>(() => {
    const active: Entry[] = residents
      .filter(passesFilter)
      .map((resident) => ({ resident, archived: false }));
    const archived: Entry[] = archivedResidents.map((resident) => ({ resident, archived: true }));

    let base: Entry[];
    if (effectiveFilter === 'archived') base = archived;
    else if (effectiveFilter === 'all') base = [...active, ...archived];
    else base = active;

    return base.filter((e) => matchesSearch(e.resident, getRoomNumber(rooms, e.resident.roomId)));
  }, [residents, archivedResidents, rooms, effectiveFilter, search]);

  // ----- Room-Wise View data -----
  const roomCards = useMemo<RoomCardData[]>(() => {
    if (effectiveFilter === 'archived') return [];
    const q = search.trim().toLowerCase();

    return [...rooms]
      .sort(
        (a, b) =>
          a.propertyId.localeCompare(b.propertyId) ||
          a.floor - b.floor ||
          a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
      )
      .map((room) => {
        // Pre-booked residents keep their bed reserved, so they are included here.
        const roomResidents = residents.filter((r) => r.roomId === room.id);
        const guests = dailyGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g));
        const occupants: Occupant[] = [
          ...roomResidents.map((r) => ({
            key: `r_${r.id}`,
            kind: 'resident' as const,
            name: r.name,
            phone: r.phone,
            resident: r,
          })),
          ...guests.map((g) => ({ key: `g_${g.id}`, kind: 'guest' as const, name: g.name, phone: g.phone })),
        ];

        const propertyName = getPropertyName(properties, room.propertyId);
        const rentFromResidents = roomResidents.find((r) => r.monthlyRent > 0)?.monthlyRent;
        const rentPerBed =
          rentFromResidents ??
          MONTHLY_RENT_BY_CAPACITY[room.capacity] ??
          properties.find((p) => p.id === room.propertyId)?.standardRent ??
          null;

        return {
          room,
          propertyName,
          rentPerBed: rentPerBed ?? null,
          beds: buildBeds(occupants, room.capacity),
          occupied: occupants.length,
          roomResidents,
          occupants,
        };
      })
      .filter((c: any) => {
        // Resident chips only keep rooms that contain a matching resident.
        if (['prebooked', 'male', 'female', 'vacating', 'due'].includes(effectiveFilter)) {
          if (!c.roomResidents.some(passesFilter)) return false;
        }
        if (!q) return true;
        return (
          c.room.roomNumber.toLowerCase().includes(q) ||
          c.propertyName.toLowerCase().includes(q) ||
          c.occupants.some(
            (o: Occupant) =>
              o.name.toLowerCase().includes(q) || (o.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))
          )
        );
      }) as RoomCardData[];
  }, [rooms, residents, dailyGuests, properties, effectiveFilter, search]);

  // Rooms that still have a free bed, used when restoring a resident.
  const roomsWithFreeBeds = useMemo(
    () =>
      rooms
        .map((room) => {
          const occupants =
            residents.filter((r) => r.roomId === room.id).length +
            dailyGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g)).length;
          return { room, free: room.capacity - occupants };
        })
        .filter((x) => x.free > 0)
        .sort(
          (a, b) =>
            a.room.propertyId.localeCompare(b.room.propertyId) ||
            a.room.floor - b.room.floor ||
            a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true })
        ),
    [rooms, residents, dailyGuests]
  );

  // ----- Bed Replace helpers -----

  // Everyone currently in a room: residents (pre-booked included) and checked-in day guests.
  const occupantsOfRoom = (roomId: string): Occupant[] => [
    ...residents
      .filter((r) => r.roomId === roomId)
      .map((r) => ({ key: `r_${r.id}`, kind: 'resident' as const, name: r.name, phone: r.phone, resident: r })),
    ...dailyGuests
      .filter((g) => g.roomId === roomId && isDailyGuestActiveNow(g))
      .map((g) => ({ key: `g_${g.id}`, kind: 'guest' as const, name: g.name, phone: g.phone })),
  ];

  // Rooms the resident can move to: any room with a free bed, plus their own room (to switch beds).
  const bedRooms = useMemo(() => {
    if (!bedTarget) return [];
    return rooms
      .map((room) => {
        const used =
          residents.filter((r) => r.roomId === room.id).length +
          dailyGuests.filter((g) => g.roomId === room.id && isDailyGuestActiveNow(g)).length;
        return { room, free: room.capacity - used };
      })
      .filter((x) => x.free > 0 || x.room.id === bedTarget.roomId)
      .sort(
        (a, b) =>
          a.room.propertyId.localeCompare(b.room.propertyId) ||
          a.room.floor - b.room.floor ||
          a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true })
      );
  }, [bedTarget, rooms, residents, dailyGuests]);

  // The beds of the room chosen in the dialog, as they look right now.
  const bedLayout = useMemo(() => {
    if (!bedTarget || !bedRoomId) return [] as (Occupant | null)[];
    const room = rooms.find((r) => r.id === bedRoomId);
    if (!room) return [];
    return buildBeds(occupantsOfRoom(bedRoomId), room.capacity).slice(0, room.capacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedTarget, bedRoomId, rooms, residents, dailyGuests]);

  const currentBedOf = (resident: AdminResident): number | null => {
    const room = rooms.find((r) => r.id === resident.roomId);
    if (!room) return null;
    const beds = buildBeds(occupantsOfRoom(resident.roomId), room.capacity);
    const i = beds.findIndex((b) => b?.resident?.id === resident.id);
    return i >= 0 ? i + 1 : null;
  };

  // Residents with no saved bed number get one now, matching what the admin sees today,
  // so moving someone never silently shuffles the others.
  const pinBeds = (roomId: string, exceptResidentId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    buildBeds(occupantsOfRoom(roomId), room.capacity).forEach((b, i) => {
      if (b?.resident && b.resident.id !== exceptResidentId && !(b.resident as any).bedNumber) {
        updateResident(b.resident.id, { bedNumber: i + 1 });
      }
    });
  };

  const openBedReplace = (resident: AdminResident) => {
    setBedTarget(resident);
    setBedRoomId(resident.roomId);
    setBedNumber(null);
  };

  const closeBedReplace = () => {
    setBedTarget(null);
    setBedRoomId(null);
    setBedNumber(null);
  };

  const handleConfirmBedReplace = () => {
    if (!bedTarget) return;
    const room = rooms.find((r) => r.id === bedRoomId);
    if (!room) {
      Alert.alert('Select a Room', 'Please choose the room to move to.');
      return;
    }
    if (bedNumber === null) {
      Alert.alert('Select a Bed', 'Please choose a bed.');
      return;
    }
    const sameRoom = room.id === bedTarget.roomId;
    if (sameRoom && currentBedOf(bedTarget) === bedNumber) {
      Alert.alert('Already in This Bed', `${bedTarget.name} is already in Bed ${bedNumber} of Room ${room.roomNumber}.`);
      return;
    }

    pinBeds(bedTarget.roomId, bedTarget.id);
    if (!sameRoom) {
      pinBeds(room.id, bedTarget.id);
      transferResidentRoom(bedTarget.id, room.propertyId, room.id);
    }
    updateResident(bedTarget.id, { bedNumber });

    const name = bedTarget.name;
    closeBedReplace();
    Alert.alert('Bed Updated', `${name} is now in Room ${room.roomNumber}, Bed ${bedNumber}.`);
  };

  // ----- actions -----
  const handleExport = async () => {
    const list: any[] = entries.map((e) => e.resident);
    if (list.length === 0) {
      Alert.alert('Nothing to Export', 'There are no residents in this list yet.');
      return;
    }
    try {
      setExporting(true);
      const label = filterRentStatus
        ? 'PendingRent'
        : effectiveFilter === 'archived'
        ? 'Archived'
        : effectiveFilter === 'all'
        ? 'All'
        : 'Active';
      const result = await exportResidentsToExcel({
        residents: list,
        rooms,
        properties,
        identityDocuments,
        label: label as any,
      });
      if (result === 'saved') Alert.alert('Saved', 'The Excel file was saved in the folder you chose.');
    } catch (e) {
      Alert.alert('Export Failed', 'Could not create the Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirmPermanentDelete = (residentId: string, name: string) => {
    Alert.alert(
      'Delete Permanently?',
      `${name}'s details, documents and payment records will be erased for good. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Permanently', style: 'destructive', onPress: () => permanentlyDeleteResident(residentId) },
      ]
    );
  };

  const confirmArchive = (resident: AdminResident) => {
    Alert.alert(
      'Archive Resident',
      `Archive ${resident.name} (Room ${getRoomNumber(rooms, resident.roomId)})? Their bed is freed and their details are kept so you can restore them later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', onPress: () => archiveResident(resident.id) },
      ]
    );
  };

  const openRestore = (resident: ArchivedResident) => {
    const oldRoomFree = roomsWithFreeBeds.some((x) => x.room.id === resident.roomId);
    setRestoreTarget(resident);
    setRestoreRoomId(oldRoomFree ? resident.roomId : null);
    setRestoreRent(String(resident.monthlyRent));
  };

  const handleConfirmRestore = () => {
    if (!restoreTarget) return;
    const chosen = roomsWithFreeBeds.find((x) => x.room.id === restoreRoomId);
    if (!chosen) {
      Alert.alert('Select a Room', 'Please choose a room with a free bed.');
      return;
    }
    const rentValue = Number(restoreRent);
    if (isNaN(rentValue) || rentValue <= 0) {
      Alert.alert('Invalid Rent', 'Please enter a valid monthly rent.');
      return;
    }
    const result = restoreResident(restoreTarget.id, {
      roomId: chosen.room.id,
      propertyId: chosen.room.propertyId,
      monthlyRent: rentValue,
    });
    if (!result.ok) {
      Alert.alert('Could Not Restore', result.message ?? 'Something went wrong.');
      return;
    }
    const name = restoreTarget.name;
    setRestoreTarget(null);
    setFilter('active');
    Alert.alert('Resident Restored', `${name} is an active resident again.`);
  };

  const openAllot = (room: Room) => navigation.navigate('AdminResidentForm', { roomId: room.id, propertyId: room.propertyId });

  // ----- header (toggle, search, chips) -----
  const CHIPS: { key: Filter; label: string }[] = [
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'prebooked', label: `Pre-booked (${counts.prebooked})` },
    { key: 'all', label: `All Records (${counts.all})` },
    { key: 'archived', label: `Archived (${counts.archived})` },
    { key: 'male', label: `Male (${counts.male})` },
    { key: 'female', label: `Female (${counts.female})` },
    { key: 'vacating', label: `Vacating (${counts.vacating})` },
    { key: 'due', label: `Rent Due (${counts.due})` },
  ];

  const header = (
    <View>
      <View style={styles.toggle}>
        <TouchableOpacity style={[styles.toggleItem, mode === 'list' && styles.toggleItemActive]} onPress={() => setMode('list')}>
          <Ionicons name="list" size={16} color={mode === 'list' ? colors.white : colors.text} />
          <Text style={[typography.caption, styles.toggleText, { color: mode === 'list' ? colors.white : colors.text }]}>
            List View ({entries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleItem, mode === 'rooms' && styles.toggleItemActive]} onPress={() => setMode('rooms')}>
          <Ionicons name="grid-outline" size={16} color={mode === 'rooms' ? colors.white : colors.text} />
          <Text style={[typography.caption, styles.toggleText, { color: mode === 'rooms' ? colors.white : colors.text }]}>
            Room-Wise View
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.primary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, room, phone..."
          placeholderTextColor={colors.textMuted}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!filterRentStatus && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CHIPS.map((c) => {
            const on = filter === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, on && (c.key === 'active' ? styles.chipActiveGreen : styles.chipActive)]}
                onPress={() => setFilter(c.key)}
              >
                <Text style={[styles.chipText, { color: on ? colors.white : colors.text }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const bedRoom = rooms.find((r) => r.id === bedRoomId);
  const bedTargetCurrentBed = bedTarget ? currentBedOf(bedTarget) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading2, { color: colors.text }]}>{filterRentStatus ? 'Pending Rent' : 'Residents'}</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={handleExport} disabled={exporting}>
          <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('AdminPaymentNotifications')}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {mode === 'list' ? (
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.archived ? 'a' : 'r'}_${e.resident.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              {effectiveFilter === 'archived'
                ? 'No archived residents. Residents you archive will appear here so you can restore them later.'
                : effectiveFilter === 'prebooked' && !search
                ? 'No pre-booked residents. Residents booked ahead of their joining date will appear here.'
                : search
                ? 'No residents match your search.'
                : 'No residents in this list yet.'}
            </Text>
          }
          renderItem={({ item }) =>
            item.archived ? (
              <ArchivedResidentCard
                resident={item.resident as ArchivedResident}
                rooms={rooms}
                properties={properties}
                onRestore={() => openRestore(item.resident as ArchivedResident)}
                onDeletePermanently={() => confirmPermanentDelete(item.resident.id, item.resident.name)}
              />
            ) : (
              <ResidentCard
                resident={item.resident as AdminResident}
                rooms={rooms}
                properties={properties}
                onPress={() => navigation.navigate('AdminResidentDetail', { residentId: item.resident.id })}
                onMenu={() => setMenuTarget(item.resident as AdminResident)}
              />
            )
          }
        />
      ) : (
        <FlatList
          data={roomCards}
          keyExtractor={(c) => c.room.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              {effectiveFilter === 'archived'
                ? 'Archived residents are not in any room. Switch to List View to see them.'
                : rooms.length === 0
                ? 'No rooms yet. Add rooms from Room Management.'
                : 'No rooms match your search or filter.'}
            </Text>
          }
          renderItem={({ item }) => (
            <RoomCard
              data={item}
              showProperty={properties.length > 1}
              properties={properties}
              onOpenResident={(id) => navigation.navigate('AdminResidentDetail', { residentId: id })}
              onAllot={openAllot}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('AdminResidentForm', {})}>
        <Ionicons name="add" size={30} color={colors.white} />
      </TouchableOpacity>

      {/* Three-dot menu for a resident */}
      <Modal visible={!!menuTarget} transparent animationType="fade" onRequestClose={() => setMenuTarget(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuTarget(null)}>
          <View style={styles.menuSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.xs }]} numberOfLines={1}>
              {menuTarget?.name}
            </Text>
            {[
              {
                icon: 'person-outline',
                label: 'View Details',
                color: colors.text,
                onPress: () => navigation.navigate('AdminResidentDetail', { residentId: menuTarget!.id }),
              },
              {
                icon: 'create-outline',
                label: 'Edit Resident',
                color: colors.text,
                onPress: () => navigation.navigate('AdminResidentForm', { residentId: menuTarget!.id }),
              },
              {
                icon: 'logo-whatsapp',
                label: menuTarget && needsRentReminder(menuTarget) ? 'Send Rent Reminder' : 'WhatsApp Chat',
                color: WHATSAPP_GREEN,
                onPress: () => messageResident(menuTarget!, getRoomNumber(rooms, menuTarget!.roomId), properties),
              },
              {
                icon: 'swap-horizontal-outline',
                label: 'Bed Replace',
                color: colors.text,
                onPress: () => openBedReplace(menuTarget!),
              },
              {
                icon: 'log-out-outline',
                label: menuTarget?.vacatingDate ? 'Manage Vacate' : 'Vacate',
                color: colors.text,
                // Goes through the same Vacating flow used everywhere else (notice date, emergency deduction, checkout).
                onPress: () => navigation.navigate('AdminVacating', { residentId: menuTarget!.id }),
              },
              {
                icon: 'archive-outline',
                label: 'Archive (can restore)',
                color: colors.warning,
                onPress: () => confirmArchive(menuTarget!),
              },
              {
                icon: 'trash-outline',
                label: 'Delete Permanently',
                color: colors.error,
                onPress: () => confirmPermanentDelete(menuTarget!.id, menuTarget!.name),
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => {
                  const action = item.onPress;
                  setMenuTarget(null);
                  // Let the menu finish closing first, otherwise Android can swallow the navigation.
                  setTimeout(action, 300);
                }}
              >
                <Ionicons name={item.icon as any} size={20} color={item.color} />
                <Text style={[typography.body, { color: item.color, marginLeft: spacing.sm }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bed Replace dialog */}
      <Modal visible={!!bedTarget} transparent animationType="fade" onRequestClose={closeBedReplace}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={[typography.heading3, { color: colors.text }]}>Bed Replace</Text>
              <TouchableOpacity onPress={closeBedReplace} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {bedTarget && (
              <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                {bedTarget.name} is in Room {getRoomNumber(rooms, bedTarget.roomId)}
                {bedTargetCurrentBed ? `, Bed ${bedTargetCurrentBed}` : ''}. Choose the new room and bed.
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[typography.caption, styles.label]}>Room</Text>
              <View style={styles.roomList}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {bedRooms.length === 0 && (
                    <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.md }]}>
                      No rooms are available.
                    </Text>
                  )}
                  {bedRooms.map(({ room, free }) => {
                    const selected = room.id === bedRoomId;
                    const isCurrent = room.id === bedTarget?.roomId;
                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={[styles.roomOption, selected && styles.roomOptionSelected]}
                        onPress={() => {
                          setBedRoomId(room.id);
                          setBedNumber(null);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                            Room {room.roomNumber}
                            {isCurrent ? ' (current room)' : ''}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                            {getPropertyName(properties, room.propertyId)} · Floor {room.floor} · {room.capacity} Sharing ·{' '}
                            {Math.max(0, free)} free
                          </Text>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {!!bedRoom && (
                <>
                  <Text style={[typography.caption, styles.label]}>Bed in Room {bedRoom.roomNumber}</Text>
                  <View style={styles.bedChipRow}>
                    {bedLayout.map((occupant, i) => {
                      const n = i + 1;
                      const isCurrent = !!occupant && occupant.resident?.id === bedTarget?.id;
                      const taken = !!occupant && !isCurrent;
                      const chosen = bedNumber === n;
                      return (
                        <TouchableOpacity
                          key={n}
                          disabled={taken}
                          activeOpacity={0.8}
                          onPress={() => setBedNumber(n)}
                          style={[
                            styles.bedChip,
                            isCurrent && styles.bedChipCurrent,
                            taken && styles.bedChipTaken,
                            chosen && styles.bedChipChosen,
                          ]}
                        >
                          <Text style={[typography.bodyBold, { color: chosen ? colors.white : colors.text }]}>Bed {n}</Text>
                          <Text
                            style={[typography.caption, { color: chosen ? colors.white : colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {isCurrent ? 'Current' : taken ? occupant!.name : 'Vacant'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmButton, (!bedRoomId || bedNumber === null) && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleConfirmBedReplace}
            >
              <Text style={[typography.button, { color: colors.white }]}>
                {bedNumber !== null ? `Move to Bed ${bedNumber}` : 'Select a Bed'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Restore dialog */}
      <Modal visible={!!restoreTarget} transparent animationType="fade" onRequestClose={() => setRestoreTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>Restore Resident</Text>
                <TouchableOpacity onPress={() => setRestoreTarget(null)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {restoreTarget && (
                <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                  {restoreTarget.name} will become an active resident again with rent set to Pending and today as the joining date.
                </Text>
              )}

              <Text style={[typography.caption, styles.label]}>Room</Text>
              <View style={styles.roomList}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {roomsWithFreeBeds.length === 0 && (
                    <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.md }]}>
                      No rooms have a free bed right now.
                    </Text>
                  )}
                  {roomsWithFreeBeds.map(({ room, free }) => {
                    const selected = room.id === restoreRoomId;
                    const isOldRoom = room.id === restoreTarget?.roomId;
                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={[styles.roomOption, selected && styles.roomOptionSelected]}
                        onPress={() => setRestoreRoomId(room.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                            Room {room.roomNumber}
                            {isOldRoom ? ' (previous room)' : ''}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                            {getPropertyName(properties, room.propertyId)} · Floor {room.floor} · {free} bed{free !== 1 ? 's' : ''} free
                          </Text>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={[typography.caption, styles.label]}>Monthly Rent (₹)</Text>
              <TextInput
                style={styles.input}
                value={restoreRent}
                onChangeText={setRestoreRent}
                keyboardType="numeric"
                placeholder="e.g. 8500"
                placeholderTextColor={colors.textMuted}
              />

              <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85} onPress={handleConfirmRestore}>
                <Text style={[typography.button, { color: colors.white }]}>Restore Resident</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerIcon: { padding: spacing.xs, marginLeft: spacing.xs },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 110 },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  toggleItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  toggleItemActive: { backgroundColor: colors.primary },
  toggleText: { fontWeight: '700', marginLeft: 6 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  chipRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipActiveGreen: { backgroundColor: colors.success, borderColor: colors.success },
  chipText: { fontSize: 13, fontWeight: '700', includeFontPadding: false },

  // list cards
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
  cardBody: { flex: 1, marginHorizontal: spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: AVATAR_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 44, height: 44, borderRadius: radius.full },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roomTag: { backgroundColor: '#FEF3C7', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 },
  roomTagText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  rentPill: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  roundIcon: { padding: 6, marginLeft: 2 },

  archivedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archivedTop: { flexDirection: 'row', alignItems: 'center' },
  archivedActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  archivedButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  restoreButton: { backgroundColor: colors.success },
  permDeleteButton: { borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface },

  // room cards
  roomCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  roomHeader: { flexDirection: 'row', alignItems: 'center' },
  roomBadge: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  roomBadgeText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  vacancyPill: { borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#FFFBEB', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  fullPill: { borderColor: colors.success, backgroundColor: '#ECFDF5' },
  sectionLabel: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  bedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  bedTag: { backgroundColor: '#FEF3C7', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, marginRight: spacing.sm },
  bedTagVacant: { backgroundColor: '#D1FAE5' },
  bedTagText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  smallIcon: { padding: 6 },
  vacantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  allotButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  allVacantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  // menu + dialogs
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  menuSheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.border },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  label: { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  roomList: { maxHeight: 200, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  roomOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  roomOptionSelected: { backgroundColor: colors.primaryLight },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  confirmButton: { backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },

  // bed replace
  bedChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bedChip: {
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
  },
  bedChipCurrent: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  bedChipTaken: { borderColor: colors.border, backgroundColor: colors.background, opacity: 0.55 },
  bedChipChosen: { backgroundColor: colors.primary, borderColor: colors.primary },
});