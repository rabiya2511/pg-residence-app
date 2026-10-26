import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminComplaint, AdminResident } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';
import ResidentAvatar from '../../components/common/ResidentAvatar';

const statusColors: Record<string, { bg: string; text: string }> = {
  Open: { bg: '#FEE2E2', text: colors.error },
  'In Progress': { bg: '#FEF3C7', text: colors.warning },
  Resolved: { bg: '#D1FAE5', text: colors.success },
};

const nextStatus: Record<AdminComplaint['status'], AdminComplaint['status']> = {
  Open: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Open',
};

// Categories offered when an admin raises a complaint. Edit this list to match the
// categories your residents see on their complaint screen.
const MAX_PHOTOS = 3;

const COMPLAINT_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Food',
  'Internet / WiFi',
  'Noise',
  'Security',
  'Other',
];

function ComplaintCard({
  complaint,
  resident,
  onChangeStatus,
}: {
  complaint: AdminComplaint;
  resident?: AdminResident;
  onChangeStatus: () => void;
}) {
  const statusStyle = statusColors[complaint.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardAvatar}>
          <ResidentAvatar
            uri={resident?.profileImageUri}
            name={resident?.name ?? complaint.residentName}
            size={40}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={[typography.bodyBold, { color: colors.text, flex: 1, marginRight: spacing.xs }]}>
              {complaint.residentName} · {complaint.room}
            </Text>
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: statusStyle.bg }]}
              onPress={onChangeStatus}
              activeOpacity={0.7}
            >
              <Text style={[typography.caption, { color: statusStyle.text }]}>
                {complaint.status}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[typography.caption, { color: colors.primary, marginTop: 4 }]}>
            {complaint.category}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 2 }]}>
            {complaint.description}
          </Text>
          {Array.isArray((complaint as any).photos) && (complaint as any).photos.length > 0 && (
            <View style={styles.cardPhotoRow}>
              {(complaint as any).photos.map((u: string) => (
                <Image key={u} source={{ uri: u }} style={styles.cardPhoto} />
              ))}
            </View>
          )}
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
            {complaint.date}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminComplaintsScreen() {
  const route = useRoute<any>();
  const filterStatus: AdminComplaint['status'] | undefined = route.params?.filterStatus;
  const { complaints, residents, rooms, properties, activeProperty, updateComplaintStatus, markComplaintViewed, addComplaint, clearComplaints } = useAdmin();

  const [whatsappVisible, setWhatsappVisible] = useState(false);
  const [whatsappRecipients, setWhatsappRecipients] = useState<WhatsAppRecipient[]>([]);

  // ---- "Raise complaint" form ----
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [residentSearch, setResidentSearch] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const visibleComplaints = filterStatus
    ? complaints.filter((c) => c.status === filterStatus)
    : complaints;

  const roomNumberOf = (roomId: string) => rooms.find((r) => r.id === roomId)?.roomNumber ?? '-';

  // Finds the resident a complaint belongs to (by id first, then by name + room, then by name).
  const findResident = (complaint: AdminComplaint): AdminResident | undefined => {
    const norm = (v: any) => String(v ?? '').trim().toLowerCase();
    const cAny = complaint as any;
    return (
      residents.find((r) => cAny.residentId && r.id === cAny.residentId) ||
      residents.find(
        (r) => norm(r.name) === norm(complaint.residentName) && norm(roomNumberOf(r.roomId)) === norm(complaint.room)
      ) ||
      residents.find((r) => norm(r.name) === norm(complaint.residentName))
    );
  };

  const filteredResidents = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    return residents.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || roomNumberOf(r.roomId).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, rooms, residentSearch]);

  const openRaise = () => {
    setResidentSearch('');
    setSelectedResidentId(null);
    setCategory(COMPLAINT_CATEGORIES[0]);
    setDescription('');
    setPhotos([]);
    setRaiseOpen(true);
  };

  const addPhoto = (uri?: string) => {
    if (uri) setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, uri]));
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission Needed', 'Allow camera access in your phone settings to take a photo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!res.canceled) addPhoto(res.assets?.[0]?.uri);
    } catch (e: any) {
      console.warn('camera failed:', e?.message ?? e);
      Alert.alert('Camera Error', `Could not open the camera.\n\n${e?.message ?? ''}`.trim());
    }
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      let res;
      try {
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      } catch (first: any) {
        // Retry with the plain defaults in case this picker version rejects the options above.
        console.warn('gallery first attempt failed:', first?.message);
        // Older Android file picker: works on emulators / devices without the system photo picker.
        res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, legacy: true } as any);
      }
      if (!res.canceled) addPhoto(res.assets?.[0]?.uri);
    } catch (e: any) {
      console.warn('gallery failed:', e?.message ?? e);
      Alert.alert('Gallery Not Available', 'This device has no gallery app available. Use Take Photo instead.');
    }
  };

  const handleRaise = () => {
    const resident = residents.find((r) => r.id === selectedResidentId);
    if (!resident) {
      Alert.alert('Select a Resident', 'Choose the resident this complaint is for.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Add Details', 'Please describe the complaint.');
      return;
    }
    // Same function the residents use, so it lands in Open Complaints, the bell and the reports.
    addComplaint({
      residentName: resident.name,
      room: roomNumberOf(resident.roomId),
      category,
      description: description.trim(),
      residentId: resident.id,
      propertyId: resident.propertyId,
      photoUris: photos,
    });
    setRaiseOpen(false);
    Alert.alert('Complaint Raised', `Complaint added for ${resident.name}.`);
  };

  // ---- "Clear data" (top corner) ----
  const runClear = (mode: 'resolved' | 'all') => {
    const label = mode === 'all' ? 'ALL complaints' : 'all resolved complaints';
    Alert.alert(
      'Clear Complaints?',
      `This permanently deletes ${label} of ${activeProperty?.name ?? 'this property'}. It cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await clearComplaints(mode);
            if (!res.ok) Alert.alert('Could Not Clear', res.message ?? 'Please try again.');
            else Alert.alert('Cleared', res.count > 0 ? `${res.count} complaint${res.count > 1 ? 's' : ''} deleted.` : 'There was nothing to clear.');
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    if (complaints.length === 0) {
      Alert.alert('Nothing to Clear', 'There are no complaints to clear.');
      return;
    }
    Alert.alert('Clear Complaints', 'What would you like to delete?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolved Only', onPress: () => runClear('resolved') },
      { text: 'All Complaints', style: 'destructive', onPress: () => runClear('all') },
    ]);
  };

  const handleChangeStatus = (complaint: AdminComplaint) => {
    const newStatus = nextStatus[complaint.status];
    Alert.alert('Update Status', `Change status to "${newStatus}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          updateComplaintStatus(complaint.id, newStatus);

          const cAny = complaint as any;
          const resident = findResident(complaint);
          // Not in the loaded list (e.g. moved out / archived)? Read the record straight from Firestore.
          let fetched: any = null;
          if (!resident && cAny.residentId) {
            try {
              const snap: any = await getDoc(doc(getFirestore(), 'residents', cAny.residentId));
              const ok = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
              if (ok) fetched = snap.data();
            } catch {
              // admin may not have access; fall through
            }
          }
          const phone = resident?.phone || fetched?.phone || cAny.residentPhone || cAny.phone || '';
          const pgName =
            properties.find((p) => p.id === (resident?.propertyId || fetched?.propertyId || cAny.propertyId))?.name ??
            activeProperty?.name ??
            'your PG';
          if (__DEV__) console.log('[WhatsApp] complaint', complaint.id, 'resident found:', !!resident, 'fetched:', !!fetched, 'phone:', phone, 'keys:', Object.keys(cAny).join(','));

          const statusMessages: Record<AdminComplaint['status'], string> = {
            Open: `Hi ${complaint.residentName}, your complaint (${complaint.category}) has been reopened. Our team will look into it.`,
            'In Progress': `Hi ${complaint.residentName}, your complaint (${complaint.category}) is now being worked on. We'll update you once resolved.`,
            Resolved: `Hi ${complaint.residentName}, your complaint (${complaint.category}) has been marked as resolved. Please let us know if the issue persists. — ${pgName}`,
          };

          setWhatsappRecipients([
            {
              id: complaint.id,
              name: complaint.residentName,
              phone,
              profileImageUri: resident?.profileImageUri ?? fetched?.profileImageUri ?? null,
              message: statusMessages[newStatus],
            },
          ]);
          setWhatsappVisible(true);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading2, { color: colors.text }]}>
            {filterStatus ? `${filterStatus} Complaints` : 'Complaints'}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {visibleComplaints.length} total
          </Text>
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          activeOpacity={0.85}
          onPress={handleClearData}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.raiseButton} activeOpacity={0.85} onPress={openRaise}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={[typography.button, { color: colors.white, marginLeft: 4 }]}>Raise</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visibleComplaints}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ComplaintCard
            complaint={item}
            resident={findResident(item)}
            onChangeStatus={() => handleChangeStatus(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.text, textAlign: 'center', marginTop: spacing.xl }]}>
            No complaints here yet.
          </Text>
        }
      />

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="Complaint Update"
        recipients={whatsappRecipients}
      />

      {/* Raise a complaint on behalf of a resident */}
      <Modal visible={raiseOpen} transparent animationType="fade" onRequestClose={() => setRaiseOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
                Raise Complaint
              </Text>

              <Text style={styles.formLabel}>Resident *</Text>
              <TextInput
                style={styles.input}
                value={residentSearch}
                onChangeText={setResidentSearch}
                placeholder="Search by name or room"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.residentList}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredResidents.length === 0 && (
                    <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.sm }]}>
                      {residents.length === 0 ? 'No residents yet.' : 'No resident matches your search.'}
                    </Text>
                  )}
                  {filteredResidents.map((r) => {
                    const selected = r.id === selectedResidentId;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.residentRow, selected && styles.residentRowActive]}
                        onPress={() => setSelectedResidentId(r.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.residentRowAvatar}>
                          <ResidentAvatar uri={r.profileImageUri} name={r.name} size={28} />
                        </View>
                        <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                          {r.name} · Room {roomNumberOf(r.roomId)}
                        </Text>
                        {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.chipWrap}>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[typography.caption, { color: category === c ? colors.white : colors.text }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Details *</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the issue..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.formLabel}>Photos (optional, up to {MAX_PHOTOS})</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.85}>
                  <Ionicons name="camera" size={18} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                    Take Photo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={18} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                    Gallery
                  </Text>
                </TouchableOpacity>
              </View>
              {photos.length > 0 && (
                <View style={styles.thumbRow}>
                  {photos.map((uri, i) => (
                    <View key={uri + i} style={styles.thumbWrap}>
                      <Image source={{ uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close" size={12} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setRaiseOpen(false)}>
                  <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleRaise}>
                  <Text style={[typography.button, { color: colors.white }]}>Raise Complaint</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: spacing.md,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: `${colors.error}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  raiseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardAvatar: {
    marginRight: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  // Raise-complaint form
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: '88%',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  residentList: {
    maxHeight: 150,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  residentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  residentRowAvatar: {
    marginRight: spacing.sm,
  },
  residentRowActive: {
    backgroundColor: colors.primaryLight,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  cardPhoto: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.border },
  photoActions: { flexDirection: 'row', gap: spacing.sm },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
  },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.border },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
  },
  saveBtn: {
    flex: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
  },
});