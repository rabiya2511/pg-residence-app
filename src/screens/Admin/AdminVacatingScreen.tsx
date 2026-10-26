import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident, Room, getEmergencyVacateDeductionPercent } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Parses "25 Sep 2026" (dd MMM yyyy) into a comparable timestamp
function parseVacatingDate(str: string): number {
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return Number.MAX_SAFE_INTEGER;
  return new Date(Number(m[3]), monthIdx, Number(m[1])).getTime();
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

// Same format the rest of the app uses ("25 Sep 2026")
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type VacateSection = { key: 'due' | 'upcoming'; title: string; data: AdminResident[] };

function VacatingCard({
  resident,
  isDue,
  isEarliest,
  rooms,
  propertyName,
  onCancel,
  onCheckout,
}: {
  resident: AdminResident;
  isDue: boolean;
  isEarliest: boolean;
  rooms: Room[];
  propertyName: string;
  onCancel: () => void;
  onCheckout: () => void;
}) {
  const roomNumber = rooms.find((r) => r.id === resident.roomId)?.roomNumber ?? 'Unassigned';
  const deduction = resident.emergencyVacateDeductionPercent;
  const highlighted = isEarliest || isDue;

  // "Vacating today" / "Vacated 3 days ago"
  let dueLabel = '';
  if (isDue && resident.vacatingDate) {
    const diff = Math.round((parseVacatingDate(resident.vacatingDate) - startOfToday()) / DAY_MS);
    dueLabel = diff === 0 ? 'Vacating today' : `Vacated ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`;
  }

  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatarWrap, highlighted && styles.avatarHighlighted]}>
          <Ionicons name="exit-outline" size={20} color={highlighted ? colors.white : colors.primary} />
        </View>
        <View style={styles.content}>
          <View style={styles.rowTop}>
            <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {resident.name}
            </Text>
            {isDue ? (
              <View style={styles.soonestBadge}>
                <Text style={[typography.caption, { color: colors.white }]}>Due for checkout</Text>
              </View>
            ) : isEarliest ? (
              <View style={styles.soonestBadge}>
                <Text style={[typography.caption, { color: colors.white }]}>Vacating Soonest</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            Room {roomNumber} · {propertyName}
          </Text>
          <Text style={[typography.bodyBold, { color: highlighted ? colors.error : colors.text, marginTop: spacing.xs }]}>
            {isDue ? `${dueLabel} · ${resident.vacatingDate}` : `Vacating on ${resident.vacatingDate}`}
          </Text>
          {deduction !== null && deduction !== undefined && (
            <Text style={[typography.caption, { color: colors.error, marginTop: 2 }]}>
              Emergency vacate · {deduction}% deduction
            </Text>
          )}
          {!!resident.vacateReason && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
              Reason: {resident.vacateReason}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.buttonRow}>
        {isDue && (
          <TouchableOpacity style={styles.checkoutButton} activeOpacity={0.85} onPress={onCheckout}>
            <Ionicons name="checkmark-done-outline" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
              Complete Checkout
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={onCancel}>
          <Ionicons name="close-circle-outline" size={16} color={colors.error} />
          <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 6 }]}>
            Cancel Vacate
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminVacatingScreen() {
  const { residents, rooms, properties, submitVacateNotice, archiveResident } = useAdmin();
  const route = useRoute<any>();
  const requestedResidentId: string | undefined = route.params?.residentId;
  const handledRequestRef = useRef<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [vacateDate, setVacateDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [reason, setReason] = useState('');

  const getPropertyName = (propertyId: string) =>
    properties.find((p) => p.id === propertyId)?.name ?? 'Unknown Property';

  const getRoomNumber = (roomId: string) => rooms.find((r) => r.id === roomId)?.roomNumber ?? 'Unassigned';

  // Every resident with a vacating date is listed, the same rule the dashboard's Vacating count uses.
  // Date today or earlier = due for checkout; later = upcoming.
  const { dueList, upcomingList } = useMemo(() => {
    const today = startOfToday();
    const all = residents
      .filter((r) => !!r.vacatingDate)
      .sort((a, b) => parseVacatingDate(a.vacatingDate!) - parseVacatingDate(b.vacatingDate!));
    return {
      dueList: all.filter((r) => parseVacatingDate(r.vacatingDate!) <= today),
      upcomingList: all.filter((r) => parseVacatingDate(r.vacatingDate!) > today),
    };
  }, [residents]);

  const totalNotices = dueList.length + upcomingList.length;

  const sections: VacateSection[] = [
    { key: 'due' as const, title: 'Due for checkout', data: dueList },
    { key: 'upcoming' as const, title: 'Upcoming', data: upcomingList },
  ].filter((s) => s.data.length > 0);

  // Residents who have no vacate notice yet — the ones the admin can vacate.
  const availableResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents
      .filter((r) => !r.vacatingDate)
      .filter((r) => {
        if (!q) return true;
        const room = rooms.find((rm) => rm.id === r.roomId)?.roomNumber ?? '';
        return r.name.toLowerCase().includes(q) || room.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [residents, rooms, search]);

  const selectedResident = residents.find((r) => r.id === selectedResidentId);

  // Preview of the deduction an emergency vacate would carry, using the same
  // rule the context applies when it saves the notice.
  const emergencyDeductionPreview = useMemo(() => {
    if (!isEmergency) return null;
    const now = new Date();
    const daysNotice = Math.floor((vacateDate.getTime() - now.getTime()) / DAY_MS);
    return getEmergencyVacateDeductionPercent(Math.max(0, daysNotice));
  }, [isEmergency, vacateDate]);

  const openModal = () => {
    setSearch('');
    setSelectedResidentId(null);
    setVacateDate(new Date());
    setIsEmergency(false);
    setReason('');
    setShowDatePicker(false);
    setModalVisible(true);
  };

  // Opened from a resident's menu ("Vacate"): open the dialog with that resident already chosen.
  // (A resident who already has a vacate notice is simply shown in the list below.)
  useEffect(() => {
    if (!requestedResidentId || handledRequestRef.current === requestedResidentId) return;
    const target = residents.find((r) => r.id === requestedResidentId);
    if (!target) return; // residents may still be loading
    handledRequestRef.current = requestedResidentId;
    if (target.vacatingDate) return;
    setSearch('');
    setSelectedResidentId(target.id);
    setVacateDate(new Date());
    setIsEmergency(false);
    setReason('');
    setShowDatePicker(false);
    setModalVisible(true);
  }, [requestedResidentId, residents]);

  const handleDateChange = (_event: any, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) setVacateDate(selected);
  };

  const handleSubmit = () => {
    if (!selectedResident) {
      Alert.alert('Select a Resident', 'Please choose the resident who is vacating.');
      return;
    }
    const dateStr = formatDisplayDate(vacateDate);
    submitVacateNotice(selectedResident.id, dateStr, isEmergency, reason.trim() || null);
    setModalVisible(false);
    Alert.alert('Vacate Notice Recorded', `${selectedResident.name} will vacate on ${dateStr}.`);
  };

  const handleCancelVacate = (resident: AdminResident) => {
    Alert.alert(
      'Cancel Vacate',
      `Remove the vacate notice for ${resident.name}? They will stay as an active resident.`,
      [
        { text: 'Keep Notice', style: 'cancel' },
        {
          text: 'Cancel Vacate',
          style: 'destructive',
          onPress: () => submitVacateNotice(resident.id, null),
        },
      ]
    );
  };

  // Moves the resident to the archive: their bed is freed, their records are kept.
  const handleCompleteCheckout = (resident: AdminResident) => {
    Alert.alert(
      'Complete Checkout',
      `Move ${resident.name} to the archive? Their bed will be freed and their records are kept.`,
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Complete Checkout',
          style: 'destructive',
          onPress: () => archiveResident(resident.id, resident.vacateReason ?? 'Vacated'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading2, { color: colors.text }]}>Vacating</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {totalNotices} notice(s)
            {dueList.length > 0 ? ` · ${dueList.length} due for checkout` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.vacateButton} activeOpacity={0.85} onPress={openModal}>
          <Ionicons name="exit-outline" size={16} color={colors.white} />
          <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
            Vacate Resident
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No vacate notices submitted yet.
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[typography.bodyBold, { color: section.key === 'due' ? colors.error : colors.text }]}>
              {section.title}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <VacatingCard
            resident={item}
            isDue={section.key === 'due'}
            isEarliest={section.key === 'upcoming' && index === 0}
            rooms={rooms}
            propertyName={getPropertyName(item.propertyId)}
            onCancel={() => handleCancelVacate(item)}
            onCheckout={() => handleCompleteCheckout(item)}
          />
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>Vacate Resident</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[typography.caption, styles.label]}>Resident</Text>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name or room..."
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.residentList}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {availableResidents.length === 0 && (
                      <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.md }]}>
                        {residents.filter((r) => !r.vacatingDate).length === 0
                          ? 'Every resident already has a vacate notice.'
                          : 'No residents match your search.'}
                      </Text>
                    )}
                    {availableResidents.map((r) => {
                      const selected = r.id === selectedResidentId;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[styles.residentOption, selected && styles.residentOptionSelected]}
                          onPress={() => setSelectedResidentId(r.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                              {r.name}
                            </Text>
                            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                              Room {getRoomNumber(r.roomId)} · {getPropertyName(r.propertyId)}
                            </Text>
                          </View>
                          {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <Text style={[typography.caption, styles.label]}>Vacating Date</Text>
                <TouchableOpacity style={styles.dateInput} activeOpacity={0.7} onPress={() => setShowDatePicker(true)}>
                  <Text style={[typography.body, { color: colors.text }]}>{formatDisplayDate(vacateDate)}</Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={vacateDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}

                <TouchableOpacity
                  style={styles.emergencyRow}
                  activeOpacity={0.8}
                  onPress={() => setIsEmergency((prev) => !prev)}
                >
                  <Ionicons
                    name={isEmergency ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isEmergency ? colors.error : colors.textMuted}
                  />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>Emergency vacate</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      Short-notice exit that may carry a deduction.
                    </Text>
                  </View>
                </TouchableOpacity>
                {isEmergency && emergencyDeductionPreview !== null && (
                  <Text style={[typography.caption, { color: colors.error, marginBottom: spacing.sm }]}>
                    Deduction for this notice period: {emergencyDeductionPreview}%
                  </Text>
                )}

                <Text style={[typography.caption, styles.label]}>Reason (optional)</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Job transfer, course completed..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85} onPress={handleSubmit}>
                  <Text style={[typography.button, { color: colors.white }]}>Confirm Vacate</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  vacateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHighlighted: {
    borderColor: colors.error,
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
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
  avatarHighlighted: {
    backgroundColor: colors.error,
  },
  content: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  soonestBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  checkoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.success,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
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
    marginBottom: spacing.sm,
  },
  label: { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  residentList: {
    maxHeight: 180,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  residentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  residentOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  reasonInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  confirmButton: {
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});