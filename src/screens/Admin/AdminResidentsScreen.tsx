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
import { AdminResident, Room, Property } from '../../constants/mockData';
import { useAdmin, isDailyGuestActiveNow, ArchivedResident } from '../../context/AdminContext';
import { exportResidentsToExcel } from '../../services/exportResidentsToExcel';

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
};

function getRoomNumber(rooms: Room[], roomId: string): string {
  return rooms.find((r) => r.id === roomId)?.roomNumber ?? 'Unassigned';
}

function getPropertyName(properties: Property[], propertyId: string): string {
  return properties.find((p) => p.id === propertyId)?.name ?? 'Unknown Property';
}

function handleCall(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Unable to Call', 'Could not open the dialer.');
  });
}

function handleWhatsAppReminder(resident: AdminResident, roomNumber: string) {
  const cleaned = resident.phone.replace(/[^\d]/g, '');
  const message = `Hi ${resident.name}, this is a reminder that your rent of ₹${resident.monthlyRent} (Room ${roomNumber}) is currently ${resident.rentStatus}. Please make the payment at your earliest convenience. — Lokansh Aditya PG Residency`;
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

function handleWhatsAppChat(phone: string) {
  const cleaned = phone.replace(/[^\d]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}`).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

function ResidentCard({
  resident,
  rooms,
  properties,
  onPress,
  onEdit,
  onDelete,
}: {
  resident: AdminResident;
  rooms: Room[];
  properties: Property[];
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusStyle = statusColors[resident.rentStatus];
  const hasDues = resident.rentStatus !== 'Paid';
  const roomNumber = getRoomNumber(rooms, resident.roomId);
  const propertyName = getPropertyName(properties, resident.propertyId);
  // Green when rent is Paid, red for Pending or Overdue — mirrors the same
  // rentStatus badge already shown next to the name.
  const nameColor = resident.rentStatus === 'Paid' ? colors.success : colors.error;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.avatarWrap}>
        {resident.profileImageUri ? (
          <Image source={{ uri: resident.profileImageUri }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={22} color={colors.primary} />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.cardHeaderRow}>
          <Text style={[typography.bodyBold, { color: nameColor }]}>{resident.name}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[typography.caption, { color: statusStyle.text }]}>
              {resident.rentStatus}
            </Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          Room {roomNumber} · {propertyName}
        </Text>
        <View style={styles.phoneRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{resident.phone}</Text>
          {hasDues && (
            <View style={styles.phoneActions}>
              <TouchableOpacity
                style={styles.phoneActionButton}
                onPress={() => handleCall(resident.phone)}
              >
                <Ionicons name="call-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.phoneActionButton}
                onPress={() => handleWhatsAppReminder(resident, roomNumber)}
              >
                <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.rowIconButton} onPress={onEdit}>
        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.rowIconButton} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
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
  const propertyName = getPropertyName(properties, resident.propertyId);

  return (
    <View style={styles.archivedCard}>
      <View style={styles.archivedTop}>
        <View style={styles.avatarWrap}>
          {resident.profileImageUri ? (
            <Image source={{ uri: resident.profileImageUri }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={22} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.content}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            Last room: {roomNumber} · {propertyName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Archived on {resident.archivedOn}
          </Text>
          <View style={styles.phoneRow}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{resident.phone}</Text>
            <View style={styles.phoneActions}>
              <TouchableOpacity style={styles.phoneActionButton} onPress={() => handleCall(resident.phone)}>
                <Ionicons name="call-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneActionButton} onPress={() => handleWhatsAppChat(resident.phone)}>
                <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.archivedActions}>
        <TouchableOpacity style={[styles.archivedButton, styles.restoreButton]} activeOpacity={0.85} onPress={onRestore}>
          <Ionicons name="refresh-outline" size={16} color={colors.white} />
          <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.archivedButton, styles.permDeleteButton]}
          activeOpacity={0.85}
          onPress={onDeletePermanently}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 6 }]}>
            Delete Permanently
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
    rooms,
    properties,
    dailyGuests,
    identityDocuments,
  } = useAdmin();

  const [view, setView] = useState<'active' | 'archived'>('active');
  const [exporting, setExporting] = useState(false);

  // Restore dialog state
  const [restoreTarget, setRestoreTarget] = useState<ArchivedResident | null>(null);
  const [restoreRoomId, setRestoreRoomId] = useState<string | null>(null);
  const [restoreRent, setRestoreRent] = useState('');

  const showingArchived = view === 'archived' && !filterRentStatus;

  const visibleResidents = filterRentStatus
    ? residents.filter((r) => r.rentStatus === 'Pending' || r.rentStatus === 'Overdue')
    : residents;

  // Rooms that still have a free bed — used when restoring a resident.
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

  // Exports exactly the list currently on screen (Active, Archived or Pending Rent)
  // to an Excel file with every resident's details.
  const handleExport = async () => {
    const list: any[] = showingArchived ? archivedResidents : visibleResidents;
    if (list.length === 0) {
      Alert.alert('Nothing to Export', 'There are no residents in this list yet.');
      return;
    }
    try {
      setExporting(true);
      const result = await exportResidentsToExcel({
        residents: list,
        rooms,
        properties,
        identityDocuments,
        label: showingArchived ? 'Archived' : filterRentStatus ? 'PendingRent' : 'Active',
      });
      if (result === 'saved') {
        Alert.alert('Saved', 'The Excel file was saved in the folder you chose.');
      }
    } catch (e) {
      Alert.alert('Export Failed', 'Could not create the Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleRemove = (resident: AdminResident) => {
    const roomNumber = getRoomNumber(rooms, resident.roomId);
    Alert.alert(
      'Remove Resident',
      `What would you like to do with ${resident.name} (Room ${roomNumber})?\n\nArchive keeps their details so you can restore them if they return later. Delete Permanently erases everything.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive (can restore)',
          onPress: () => archiveResident(resident.id),
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => confirmPermanentDelete(resident.id, resident.name),
        },
      ]
    );
  };

  const confirmPermanentDelete = (residentId: string, name: string) => {
    Alert.alert(
      'Delete Permanently?',
      `${name}'s details, documents and payment records will be erased for good. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => permanentlyDeleteResident(residentId),
        },
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
    setView('active');
    Alert.alert('Resident Restored', `${name} is an active resident again.`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[typography.heading2, { color: colors.text }]}>
            {filterRentStatus ? 'Pending Rent' : 'Residents'}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {showingArchived ? `${archivedResidents.length} archived` : `${visibleResidents.length} total`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminResidentForm', {})}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {!filterRentStatus && (
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentItem, view === 'active' && styles.segmentItemActive]}
            onPress={() => setView('active')}
          >
            <Text
              style={[
                typography.caption,
                { color: view === 'active' ? colors.white : colors.text, fontWeight: '700' },
              ]}
            >
              Active ({residents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, view === 'archived' && styles.segmentItemActive]}
            onPress={() => setView('archived')}
          >
            <Text
              style={[
                typography.caption,
                { color: view === 'archived' ? colors.white : colors.text, fontWeight: '700' },
              ]}
            >
              Archived ({archivedResidents.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Export the resident details shown below to an Excel sheet */}
      <TouchableOpacity
        style={[styles.exportButton, exporting && { opacity: 0.6 }]}
        activeOpacity={0.85}
        onPress={handleExport}
        disabled={exporting}
      >
        <Ionicons name="download-outline" size={18} color={colors.white} />
        <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
          {exporting ? 'Preparing...' : 'Export to Excel'}
        </Text>
      </TouchableOpacity>

      {showingArchived ? (
        <FlatList
          data={archivedResidents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              No archived residents. Residents you archive will appear here so you can restore them later.
            </Text>
          }
          renderItem={({ item }) => (
            <ArchivedResidentCard
              resident={item}
              rooms={rooms}
              properties={properties}
              onRestore={() => openRestore(item)}
              onDeletePermanently={() => confirmPermanentDelete(item.id, item.name)}
            />
          )}
        />
      ) : (
        <FlatList
          data={visibleResidents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ResidentCard
              resident={item}
              rooms={rooms}
              properties={properties}
              onPress={() => navigation.navigate('AdminResidentDetail', { residentId: item.id })}
              onEdit={() => navigation.navigate('AdminResidentForm', { residentId: item.id })}
              onDelete={() => handleRemove(item)}
            />
          )}
        />
      )}

      {/* Restore dialog */}
      <Modal
        visible={!!restoreTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRestoreTarget(null)}
      >
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
                  {restoreTarget.name} will become an active resident again with rent set to Pending and today as the
                  joining date.
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
                            {getPropertyName(properties, room.propertyId)} · Floor {room.floor} · {free} bed
                            {free !== 1 ? 's' : ''} free
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
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
  archivedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archivedTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  archivedActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  archivedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  restoreButton: {
    backgroundColor: colors.success,
  },
  permDeleteButton: {
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  content: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneActions: {
    flexDirection: 'row',
  },
  phoneActionButton: {
    marginLeft: spacing.sm,
    padding: 2,
  },
  rowIconButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  roomList: {
    maxHeight: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roomOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roomOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
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
  confirmButton: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});