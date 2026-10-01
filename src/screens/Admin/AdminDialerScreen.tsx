import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { AdminResident } from '../../constants/mockData';
import SpeedDialContacts from '../../components/SpeedDialContacts';

type TabKey = 'room' | 'dialpad' | 'speed';

function handleCall(phone: string, enabled: boolean) {
  if (!enabled) {
    Alert.alert('Calling Disabled', 'Enable calling at the top of this screen first.');
    return;
  }
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Unable to Call', 'Could not open the dialer.');
  });
}

function handleWhatsApp(phone: string) {
  const cleaned = phone.replace(/[^\d]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}`).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

function ResidentCallCard({
  resident,
  roomLabel,
  callingEnabled,
}: {
  resident: AdminResident;
  roomLabel?: string;
  callingEnabled: boolean;
}) {
  const initial = resident.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.residentCard}>
      <View style={styles.residentTopRow}>
        <View style={styles.avatar}>
          <Text style={[typography.bodyBold, { color: colors.white }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={13} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]}>
              {resident.phone}
            </Text>
          </View>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[typography.caption, { color: colors.success }]}>
                {resident.vacatingDate ? 'Vacating' : 'Active'}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.text }]}>
                ₹{resident.monthlyRent}/mo
              </Text>
            </View>
            {!!resident.emergencyContact1 && (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                · Emg: {resident.emergencyContact1}
              </Text>
            )}
          </View>
        </View>
        {roomLabel && (
          <View style={styles.roomBadge}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>{roomLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.success }]}
          activeOpacity={0.85}
          onPress={() => handleCall(resident.phone, callingEnabled)}
        >
          <Ionicons name="call" size={16} color={colors.white} />
          <Text style={[typography.caption, { color: colors.white, marginLeft: 6, fontWeight: '700' }]}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.whatsappButton]}
          activeOpacity={0.85}
          onPress={() => handleWhatsApp(resident.phone)}
        >
          <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
          <Text style={[typography.caption, { color: colors.success, marginLeft: 6, fontWeight: '700' }]}>
            WhatsApp Message
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminDialerScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, properties } = useAdmin();

  const [tab, setTab] = useState<TabKey>('room');
  const [callingEnabled, setCallingEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [dialInput, setDialInput] = useState('');

  const propertyName = properties[0]?.name ?? 'My PG';

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );

  const filteredResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents.filter((r) => {
      const room = rooms.find((rm) => rm.id === r.roomId);
      if (floorFilter !== 'all' && room?.floor !== floorFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        (room?.roomNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [residents, rooms, search, floorFilter]);

  const roomGroups = useMemo(() => {
    const map = new Map<string, AdminResident[]>();
    filteredResidents.forEach((r) => {
      const list = map.get(r.roomId) ?? [];
      list.push(r);
      map.set(r.roomId, list);
    });
    return Array.from(map.entries())
      .map(([roomId, people]) => ({ room: rooms.find((r) => r.id === roomId), people }))
      .filter((g) => g.room)
      .sort((a, b) => (a.room!.floor - b.room!.floor) || a.room!.roomNumber.localeCompare(b.room!.roomNumber, undefined, { numeric: true }));
  }, [filteredResidents, rooms]);

  const handleDialpadPress = (key: string) => {
    if (dialInput.length >= 15) return;
    setDialInput((prev) => prev + key);
  };

  const handleBackspace = () => setDialInput((prev) => prev.slice(0, -1));

  const handleDialpadCall = () => {
    if (!dialInput.trim()) return;
    handleCall(dialInput, callingEnabled);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Smart Dialer</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.propertyCard}>
        <View style={styles.propertyIconWrap}>
          <Ionicons name="business" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
            {propertyName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Directory & Speed Dialing</Text>
        </View>
        <TouchableOpacity
          style={[styles.enableButton, { backgroundColor: callingEnabled ? '#D1FAE5' : '#FEE2E2' }]}
          onPress={() => setCallingEnabled((prev) => !prev)}
        >
          <Ionicons name="call-outline" size={14} color={callingEnabled ? colors.success : colors.error} />
          <Text
            style={[
              typography.caption,
              { color: callingEnabled ? colors.success : colors.error, fontWeight: '700', marginLeft: 4 },
            ]}
          >
            {callingEnabled ? 'Calling On' : 'Calling Off'}
          </Text>
        </TouchableOpacity>
        <View style={styles.countBadge}>
          <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
            {residents.length} Residents
          </Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {([
          { key: 'room', label: 'Room-Wise', icon: 'business-outline' },
          { key: 'dialpad', label: 'Dialpad', icon: 'keypad-outline' },
          { key: 'speed', label: 'Speed Dial', icon: 'call-outline' },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabButton, tab === t.key && styles.tabButtonActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={16} color={tab === t.key ? colors.primary : colors.textMuted} />
            <Text
              style={[
                typography.caption,
                { color: tab === t.key ? colors.primary : colors.textMuted, fontWeight: '700', marginLeft: 4 },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'room' && (
        <>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by resident name, room, or phone..."
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.floorRow}>
            <TouchableOpacity
              style={[styles.floorChip, floorFilter === 'all' && styles.floorChipActive]}
              onPress={() => setFloorFilter('all')}
            >
              <Text style={[styles.floorChipText, { color: floorFilter === 'all' ? colors.white : colors.text }]}>
                All
              </Text>
            </TouchableOpacity>
            {floors.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.floorChip, floorFilter === f && styles.floorChipActive]}
                onPress={() => setFloorFilter(f)}
              >
                <Text style={[styles.floorChipText, { color: floorFilter === f ? colors.white : colors.text }]}>
                  Floor {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {roomGroups.length === 0 && (
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
                No residents found.
              </Text>
            )}
            {roomGroups.map(({ room, people }) => (
              <View key={room!.id} style={styles.roomGroupCard}>
                <View style={styles.roomGroupHeader}>
                  <View style={styles.roomIconWrap}>
                    <Ionicons name="bed-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>Room {room!.roomNumber}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      Floor {room!.floor} · {room!.capacity} Sharing
                    </Text>
                  </View>
                  <View style={styles.residentCountBadge}>
                    <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                      {people.length} Resident{people.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {people.map((p) => (
                  <ResidentCallCard key={p.id} resident={p} callingEnabled={callingEnabled} />
                ))}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {tab === 'dialpad' && (
        <View style={styles.dialpadContainer}>
          <View style={styles.dialDisplay}>
            <Text style={[typography.heading2, { color: colors.text }]} numberOfLines={1}>
              {dialInput || 'Enter a number'}
            </Text>
            {dialInput.length > 0 && (
              <TouchableOpacity onPress={handleBackspace} style={styles.backspaceButton}>
                <Ionicons name="backspace-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dialGrid}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
              <TouchableOpacity key={key} style={styles.dialKey} onPress={() => handleDialpadPress(key)}>
                <Text style={[typography.heading2, { color: colors.text }]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.callNowButton, !dialInput.trim() && styles.callNowButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleDialpadCall}
            disabled={!dialInput.trim()}
          >
            <Ionicons name="call" size={20} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: spacing.sm }]}>Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'speed' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SpeedDialContacts callingEnabled={callingEnabled} />
        </ScrollView>
      )}
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
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  propertyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  floorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  floorChip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  floorChipText: {
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  roomGroupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  roomGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roomIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  residentCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  residentCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  residentTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  roomBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  whatsappButton: {
    backgroundColor: '#D1FAE5',
  },
  dialpadContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  dialDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: spacing.xl,
  },
  backspaceButton: {
    marginLeft: spacing.md,
    padding: spacing.xs,
  },
  dialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  dialKey: {
    width: '30%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    margin: '1.5%',
  },
  callNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  callNowButtonDisabled: {
    opacity: 0.5,
  },
});