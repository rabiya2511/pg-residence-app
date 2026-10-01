import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident, Room, getEmergencyVacateDeductionPercent } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parses "25 Sep 2026" (dd MMM yyyy) into a comparable timestamp
function parseVacatingDate(str: string): number {
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return Number.MAX_SAFE_INTEGER;
  return new Date(Number(m[3]), monthIdx, Number(m[1])).getTime();
}

// A resident disappears from this screen once their vacating date arrives.
// true  = hidden on the vacating day itself (leaving today = already gone)
// false = stays visible through the vacating day, hidden the day after
const HIDE_ON_VACATING_DAY = true;

function hasNotYetVacated(dateStr: string): boolean {
  const ts = parseVacatingDate(dateStr);
  if (ts === Number.MAX_SAFE_INTEGER) return true; // unreadable date: keep it visible
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return HIDE_ON_VACATING_DAY ? ts > todayStart : ts >= todayStart;
}

// Same format the rest of the app uses ("25 Sep 2026")
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VacatingCard({
  resident,
  isEarliest,
  rooms,
  propertyName,
  onCancel,
}: {
  resident: AdminResident;
  isEarliest: boolean;
  rooms: Room[];
  propertyName: string;
  onCancel: () => void;
}) {
  const roomNumber = rooms.find((r) => r.id === resident.roomId)?.roomNumber ?? 'Unassigned';
  const deduction = resident.emergencyVacateDeductionPercent;

  return (
    <View style={[styles.card, isEarliest && styles.cardHighlighted]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatarWrap, isEarliest && styles.avatarHighlighted]}>
          <Ionicons name="exit-outline" size={20} color={isEarliest ? colors.white : colors.primary} />
        </View>
        <View style={styles.content}>
          <View style={styles.rowTop}>
            <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {resident.name}
            </Text>
            {isEarliest && (
              <View style={styles.soonestBadge}>
                <Text style={[typography.caption, { color: colors.white }]}>Vacating Soonest</Text>
              </View>
            )}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            Room {roomNumber} · {propertyName}
          </Text>
          <Text style={[typography.bodyBold, { color: isEarliest ? colors.error : colors.text, marginTop: spacing.xs }]}>
            Vacating on {resident.vacatingDate}
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

      <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={onCancel}>
        <Ionicons name="close-circle-outline" size={16} color={colors.error} />
        <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 6 }]}>
          Cancel Vacate
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminVacatingScreen() {
  const { residents, rooms, properties, submitVacateNotice } = useAdmin();

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

  const vacatingResidents = residents
    .filter((r) => !!r.vacatingDate && hasNotYetVacated(r.vacatingDate))
    .sort((a, b) => parseVacatingDate(a.vacatingDate!) - parseVacatingDate(b.vacatingDate!));

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
    const daysNotice = Math.floor((vacateDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading2, { color: colors.text }]}>Vacating</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{vacatingResidents.length} notice(s)</Text>
        </View>
        <TouchableOpacity style={styles.vacateButton} activeOpacity={0.85} onPress={openModal}>
          <Ionicons name="exit-outline" size={16} color={colors.white} />
          <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
            Vacate Resident
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vacatingResidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No vacate notices submitted yet.
          </Text>
        }
        renderItem={({ item, index }) => (
          <VacatingCard
            resident={item}
            isEarliest={index === 0}
            rooms={rooms}
            propertyName={getPropertyName(item.propertyId)}
            onCancel={() => handleCancelVacate(item)}
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
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
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