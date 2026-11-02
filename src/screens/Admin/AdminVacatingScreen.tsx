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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident, Room, getEmergencyVacateDeductionPercent } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import {
  computeSettlement,
  exitStatusOf,
  heldDeposit,
  noticeGivenDays,
  unpaidRentRecords,
  ExitStatus,
  REQUIRED_NOTICE_DAYS,
} from '../../utils/exitSettlement';

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

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const digitsOnly = (t: string) => t.replace(/\D/g, '').slice(0, 7);

const STATUS_STYLE: Record<ExitStatus, { label: string; bg: string; fg: string }> = {
  Pending: { label: 'Awaiting approval', bg: '#FEF3C7', fg: '#92400E' },
  Approved: { label: 'Approved', bg: '#D1FAE5', fg: colors.success },
  Rejected: { label: 'Rejected', bg: '#FEE2E2', fg: colors.error },
};

type VacateSection = { key: 'due' | 'upcoming'; title: string; data: AdminResident[] };

function VacatingCard({
  resident,
  isDue,
  isEarliest,
  rooms,
  propertyName,
  status,
  busy,
  onCancel,
  onApprove,
  onReject,
  onSettle,
}: {
  resident: AdminResident;
  isDue: boolean;
  isEarliest: boolean;
  rooms: Room[];
  propertyName: string;
  status: ExitStatus;
  busy: boolean;
  onCancel: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSettle: () => void;
}) {
  const roomNumber = rooms.find((r) => r.id === resident.roomId)?.roomNumber ?? 'Unassigned';
  const deduction = resident.emergencyVacateDeductionPercent;
  const highlighted = isEarliest || isDue;
  const r: any = resident;
  const s = STATUS_STYLE[status];
  const submittedTs = Number(r.vacateSubmittedAt) || 0;
  const rejectReason: string | null = status === 'Rejected' ? r.exitDecision?.reason ?? null : null;

  // Notice period tracking: days given against the one month required.
  const given = noticeGivenDays(resident);
  const short = given !== null && given < REQUIRED_NOTICE_DAYS;

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
          <View style={[styles.statusChip, { backgroundColor: s.bg }]}>
            <Text style={[typography.caption, { color: s.fg, fontWeight: '700' }]}>{s.label}</Text>
          </View>
          <Text style={[typography.bodyBold, { color: highlighted ? colors.error : colors.text, marginTop: spacing.xs }]}>
            {isDue ? `${dueLabel} · ${resident.vacatingDate}` : `Vacating on ${resident.vacatingDate}`}
          </Text>
          {!!submittedTs && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Notice given on {formatDisplayDate(new Date(submittedTs))}
            </Text>
          )}
          {given !== null && (
            <Text
              style={[
                typography.caption,
                { color: short && (deduction === null || deduction === undefined) ? colors.error : colors.textMuted, marginTop: 2 },
              ]}
            >
              Notice period: {given} of {REQUIRED_NOTICE_DAYS} days
              {short ? ` · short by ${REQUIRED_NOTICE_DAYS - given} day${REQUIRED_NOTICE_DAYS - given === 1 ? '' : 's'}` : ''}
            </Text>
          )}
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
          {!!r.vacateRemarks && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
              Remarks: {r.vacateRemarks}
            </Text>
          )}
          {!!rejectReason && (
            <Text style={[typography.caption, { color: colors.error, marginTop: 2 }]}>
              Rejected: {rejectReason}
            </Text>
          )}
        </View>
      </View>

      {busy ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
      ) : (
        <View style={styles.buttonRow}>
          {status === 'Pending' && (
            <>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }]} activeOpacity={0.85} onPress={onApprove}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} />
                <Text style={[typography.caption, styles.actionText]}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.error }]} activeOpacity={0.85} onPress={onReject}>
                <Ionicons name="close-circle-outline" size={16} color={colors.white} />
                <Text style={[typography.caption, styles.actionText]}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {status === 'Approved' && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} activeOpacity={0.85} onPress={onSettle}>
              <Ionicons name="receipt-outline" size={16} color={colors.white} />
              <Text style={[typography.caption, styles.actionText]}>Settlement & Checkout</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={onCancel}>
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 6 }]}>
              Cancel Vacate
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SumRow({
  label,
  value,
  negative,
  bold,
  muted,
}: {
  label: string;
  value: string;
  negative?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.sumRow}>
      <Text style={[bold ? typography.bodyBold : typography.body, { color: muted ? colors.textMuted : colors.text, flex: 1 }]}>
        {label}
      </Text>
      <Text style={[bold ? typography.bodyBold : typography.body, { color: negative ? colors.error : muted ? colors.textMuted : colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

export default function AdminVacatingScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, properties, paymentRecords, submitVacateNotice, archiveResident } = useAdmin();
  const route = useRoute<any>();
  const db = getFirestore();
  const requestedResidentId: string | undefined = route.params?.residentId;
  const handledRequestRef = useRef<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [vacateDate, setVacateDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [reason, setReason] = useState('');

  // approve / reject
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // settlement & checkout
  const [settleId, setSettleId] = useState<string | null>(null);
  const [additionalText, setAdditionalText] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');
  const [maintenanceText, setMaintenanceText] = useState('');
  const [advanceText, setAdvanceText] = useState('');
  const [checks, setChecks] = useState({ room: false, keys: false, dues: false });
  const [settleBusy, setSettleBusy] = useState(false);

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
  const awaitingCount = [...dueList, ...upcomingList].filter((r) => exitStatusOf(r) === 'Pending').length;

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
  const rejectResident = residents.find((r) => r.id === rejectId);
  const settleResident = residents.find((r) => r.id === settleId);

  // Preview of the deduction an emergency vacate would carry, using the same
  // rule the context applies when it saves the notice.
  const emergencyDeductionPreview = useMemo(() => {
    if (!isEmergency) return null;
    const now = new Date();
    const daysNotice = Math.floor((vacateDate.getTime() - now.getTime()) / DAY_MS);
    return getEmergencyVacateDeductionPercent(Math.max(0, daysNotice));
  }, [isEmergency, vacateDate]);

  // Unpaid rent months for the resident being checked out (the "pending clearance" list).
  const unpaidItems = useMemo(
    () => (settleResident ? unpaidRentRecords(settleResident.id, paymentRecords) : []),
    [settleResident, paymentRecords]
  );

  // Live settlement figures for the resident being checked out.
  const settlement = useMemo(() => {
    if (!settleResident) return null;
    return computeSettlement({
      deposit: heldDeposit(settleResident),
      emergencyPercent: settleResident.emergencyVacateDeductionPercent,
      pendingRent: unpaidItems.reduce((sum, u) => sum + u.amount, 0),
      additional: Number(additionalText) || 0,
      pendingMaintenance: Number(maintenanceText) || 0,
      advanceCredit: Number(advanceText) || 0,
    });
  }, [settleResident, unpaidItems, additionalText, maintenanceText, advanceText]);

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
    if (selectedResident.vacatingDate) {
      Alert.alert('Already Vacating', `${selectedResident.name} already has an exit notice.`);
      return;
    }
    const dateStr = formatDisplayDate(vacateDate);
    // Recorded by the admin, so it is approved straight away.
    submitVacateNotice(selectedResident.id, dateStr, isEmergency, reason.trim() || null, null, true);
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

  const failMessage = (e: any) =>
    e?.code === 'firestore/permission-denied'
      ? 'Not allowed. Publish the latest Firestore rules and try again.'
      : e?.code === 'timeout'
      ? 'This is taking too long. Check your connection and try again.'
      : 'Check your connection and try again.';

  // Saves the admin's decision for THIS notice only (see exitStatusOf).
  const saveDecision = async (r: AdminResident, status: 'Approved' | 'Rejected', why: string | null) => {
    setBusyId(r.id);
    try {
      await Promise.race([
        updateDoc(doc(db, 'residents', r.id), {
          exitDecision: { status, for: Number((r as any).vacateSubmittedAt) || 0, at: Date.now(), reason: why },
        }),
        new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 10000)),
      ]);
      return true;
    } catch (e: any) {
      console.warn('exit decision failed:', e?.code ?? e?.message);
      Alert.alert('Could Not Save', failMessage(e));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = (r: AdminResident) => {
    Alert.alert('Approve Exit Notice', `Approve ${r.name}'s notice to vacate on ${r.vacatingDate}?`, [
      { text: 'Not Yet', style: 'cancel' },
      { text: 'Approve', onPress: () => saveDecision(r, 'Approved', null) },
    ]);
  };

  const submitReject = async () => {
    if (!rejectResident) return;
    const ok = await saveDecision(rejectResident, 'Rejected', rejectReason.trim() || null);
    if (ok) {
      setRejectId(null);
      setRejectReason('');
    }
  };

  const openSettlement = (r: AdminResident) => {
    const draft = (r as any).exitDraft ?? {};
    setAdditionalText(draft.additional ? String(draft.additional) : '');
    setAdditionalNote(draft.note ?? '');
    setMaintenanceText(draft.pendingMaintenance ? String(draft.pendingMaintenance) : '');
    setAdvanceText(draft.advanceCredit ? String(draft.advanceCredit) : '');
    setChecks({ room: !!draft.roomInspection, keys: !!draft.keysReturned, dues: !!draft.duesReviewed });
    setSettleId(r.id);
  };

  const closeSettlement = () => {
    if (settleBusy) return;
    setSettleId(null);
  };

  const draftPayload = () => ({
    additional: Math.max(0, Math.round(Number(additionalText) || 0)),
    note: additionalNote.trim() || null,
    pendingMaintenance: Math.max(0, Math.round(Number(maintenanceText) || 0)),
    advanceCredit: Math.max(0, Math.round(Number(advanceText) || 0)),
    roomInspection: checks.room,
    keysReturned: checks.keys,
    duesReviewed: checks.dues,
    savedAt: Date.now(),
  });

  // Keeps the deductions and checklist so the admin can come back later; the resident sees the estimate.
  const saveDraft = async () => {
    if (!settleResident) return;
    setSettleBusy(true);
    try {
      await Promise.race([
        updateDoc(doc(db, 'residents', settleResident.id), { exitDraft: draftPayload() }),
        new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 10000)),
      ]);
      Alert.alert('Saved', 'The settlement draft has been saved.');
    } catch (e: any) {
      console.warn('exit draft failed:', e?.code ?? e?.message);
      Alert.alert('Could Not Save', failMessage(e));
    } finally {
      setSettleBusy(false);
    }
  };

  const runCompleteCheckout = async () => {
    if (!settleResident || !settlement) return;
    const r = settleResident;
    const s = settlement;
    // One checkout record per stay: never write a second settlement over a finished one.
    if ((r as any).exitSettlement?.completedAt) {
      Alert.alert('Already Checked Out', `${r.name} already has a completed checkout.`);
      return;
    }
    setSettleBusy(true);
    try {
      await Promise.race([
        updateDoc(doc(db, 'residents', r.id), {
          exitSettlement: {
            deposit: s.deposit,
            depositStatus: r.advanceDepositStatus ?? null,
            advanceCredit: s.advanceCredit,
            emergencyPercent: r.emergencyVacateDeductionPercent ?? null,
            emergencyDeduction: s.emergencyDeduction,
            pendingRent: s.pendingRent,
            pendingRentItems: unpaidItems.map((u) => ({ month: u.month, amount: u.amount })),
            pendingMaintenance: s.pendingMaintenance,
            additionalDeductions: s.additional,
            additionalNote: additionalNote.trim() || null,
            totalDeductions: s.totalDeductions,
            refund: s.refund,
            amountOwed: s.amountOwed,
            status: s.refund > 0 ? 'Refund Pending' : s.amountOwed > 0 ? 'Amount Owed' : 'Settled',
            noticeDays: noticeGivenDays(r),
            requiredNoticeDays: REQUIRED_NOTICE_DAYS,
            roomInspection: true,
            keysReturned: true,
            duesReviewed: true,
            completedOn: formatDisplayDate(new Date()),
            completedAt: Date.now(),
          },
          exitDraft: null,
        }),
        new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 10000)),
      ]);
    } catch (e: any) {
      console.warn('exit settlement failed:', e?.code ?? e?.message);
      Alert.alert('Could Not Complete Checkout', failMessage(e));
      setSettleBusy(false);
      return;
    }
    // The settlement is saved. Now move the resident to the archive (frees the bed, keeps all records).
    archiveResident(r.id, r.vacateReason ?? 'Vacated');
    setSettleBusy(false);
    setSettleId(null);
    Alert.alert(
      'Checkout Completed',
      s.amountOwed > 0
        ? `${r.name} has been checked out. Amount still owed by the resident: ${formatINR(s.amountOwed)}.\n\nTrack it in Checkout History.`
        : `${r.name} has been checked out. Refund to the resident: ${formatINR(s.refund)}.\n\nMark it paid in Checkout History once you have returned it.`
    );
  };

  const handleCompleteCheckout = () => {
    if (!settleResident || !settlement) return;
    if (!(checks.room && checks.keys && checks.dues)) {
      Alert.alert('Checklist Incomplete', 'Tick every item in the checkout checklist before completing the checkout.');
      return;
    }
    const early = parseVacatingDate(settleResident.vacatingDate ?? '') > startOfToday();
    const result =
      settlement.amountOwed > 0
        ? `Resident owes ${formatINR(settlement.amountOwed)}`
        : `Refund ${formatINR(settlement.refund)}`;
    Alert.alert(
      'Complete Checkout',
      `Check out ${settleResident.name} and move them to the archive?\n\n${result}${
        early ? '\n\nNote: the vacating date has not arrived yet.' : ''
      }`,
      [
        { text: 'Not Yet', style: 'cancel' },
        { text: 'Complete Checkout', style: 'destructive', onPress: runCompleteCheckout },
      ]
    );
  };

  const checklistItems: { key: 'room' | 'keys' | 'dues'; label: string }[] = [
    { key: 'room', label: 'Room inspection completed' },
    { key: 'keys', label: 'Keys and belongings returned' },
    { key: 'dues', label: 'Pending dues reviewed' },
  ];
  const checklistDone = checks.room && checks.keys && checks.dues;
  const depositNotCollected =
    !!settleResident &&
    (settleResident.advanceDepositStatus === 'Not Paid') &&
    (Number(settleResident.securityDeposit) || 0) > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading2, { color: colors.text }]}>Vacating</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {totalNotices} notice(s)
            {awaitingCount > 0 ? ` · ${awaitingCount} awaiting approval` : ''}
            {dueList.length > 0 ? ` · ${dueList.length} due for checkout` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.historyButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminCheckoutHistory')}
        >
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>History</Text>
        </TouchableOpacity>
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
            No exit notices yet. When a resident submits one, Approve and Reject buttons appear here.
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
            status={exitStatusOf(item)}
            busy={busyId === item.id}
            onCancel={() => handleCancelVacate(item)}
            onApprove={() => handleApprove(item)}
            onReject={() => {
              setRejectReason('');
              setRejectId(item.id);
            }}
            onSettle={() => openSettlement(item)}
          />
        )}
      />

      {/* ---------------- Vacate Resident (admin-initiated, approved automatically) ---------------- */}
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

      {/* ---------------- Reject ---------------- */}
      <Modal visible={!!rejectResident} transparent animationType="fade" onRequestClose={() => setRejectId(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={[typography.heading3, { color: colors.text }]}>Reject exit notice</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm }]}>
                {rejectResident?.name}. The resident will see your reason.
              </Text>
              <TextInput
                style={styles.reasonInput}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Reason (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <View style={styles.sheetButtons}>
                <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.border }]} onPress={() => setRejectId(null)}>
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.error }]} onPress={submitReject}>
                  <Text style={[typography.caption, styles.actionText]}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------- Settlement & Checkout ---------------- */}
      <Modal visible={!!settleResident} transparent animationType="fade" onRequestClose={closeSettlement}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>Settlement & Checkout</Text>
                <TouchableOpacity onPress={closeSettlement}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {settleResident && settlement && (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>
                    {settleResident.name} · Room {getRoomNumber(settleResident.roomId)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    Vacating {settleResident.vacatingDate}
                  </Text>

                  <View style={styles.summaryBox}>
                    <SumRow
                      label={depositNotCollected ? 'Security deposit (not collected)' : 'Security deposit'}
                      value={formatINR(settlement.deposit)}
                      muted={depositNotCollected}
                    />
                    {settlement.advanceCredit > 0 && (
                      <SumRow label="Advance balance returned" value={`+ ${formatINR(settlement.advanceCredit)}`} />
                    )}
                    {settlement.emergencyDeduction > 0 && (
                      <SumRow
                        label={`Emergency deduction (${settleResident.emergencyVacateDeductionPercent}%)`}
                        value={`− ${formatINR(settlement.emergencyDeduction)}`}
                        negative
                      />
                    )}
                    {settlement.pendingRent > 0 && (
                      <SumRow label="Pending rent" value={`− ${formatINR(settlement.pendingRent)}`} negative />
                    )}
                    {settlement.pendingMaintenance > 0 && (
                      <SumRow label="Pending maintenance" value={`− ${formatINR(settlement.pendingMaintenance)}`} negative />
                    )}
                    {settlement.additional > 0 && (
                      <SumRow label="Other deductions" value={`− ${formatINR(settlement.additional)}`} negative />
                    )}
                    <View style={styles.sumDivider} />
                    {settlement.amountOwed > 0 ? (
                      <SumRow label="Resident owes" value={formatINR(settlement.amountOwed)} negative bold />
                    ) : (
                      <SumRow label="Refundable amount" value={formatINR(settlement.refund)} bold />
                    )}
                  </View>
                  {depositNotCollected && (
                    <Text style={[typography.caption, { color: colors.warning, marginTop: spacing.xs }]}>
                      The {formatINR(Number(settleResident.securityDeposit) || 0)} deposit was marked Not Paid, so nothing is held to refund.
                    </Text>
                  )}

                  <Text style={[typography.caption, styles.label]}>Pending clearance</Text>
                  <View style={styles.clearanceBox}>
                    {unpaidItems.length === 0 ? (
                      <Text style={[typography.caption, { color: colors.success }]}>No pending rent. All months are paid.</Text>
                    ) : (
                      unpaidItems.map((u) => (
                        <View key={u.id} style={styles.sumRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[typography.body, { color: colors.text }]}>{u.month}</Text>
                            <Text style={[typography.caption, { color: colors.textMuted }]}>
                              Due {u.dueDate} · {u.status}
                            </Text>
                          </View>
                          <Text style={[typography.bodyBold, { color: colors.error }]}>{formatINR(u.amount)}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  <Text style={[typography.caption, styles.label]}>Pending maintenance (₹)</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={maintenanceText}
                    onChangeText={(t) => setMaintenanceText(digitsOnly(t))}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                  <Text style={[typography.caption, styles.label]}>Advance balance to return (₹)</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={advanceText}
                    onChangeText={(t) => setAdvanceText(digitsOnly(t))}
                    placeholder="0 (rent paid in advance, if any)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                  <Text style={[typography.caption, styles.label]}>Other deductions (₹) — damages, keys, etc.</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={additionalText}
                    onChangeText={(t) => setAdditionalText(digitsOnly(t))}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                  <Text style={[typography.caption, styles.label]}>Note for deductions</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={additionalNote}
                    onChangeText={setAdditionalNote}
                    placeholder="e.g. Broken chair, lost key"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />

                  <Text style={[typography.caption, styles.label]}>Checkout checklist</Text>
                  {checklistItems.map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      style={styles.checkRow}
                      activeOpacity={0.8}
                      onPress={() => setChecks((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                    >
                      <Ionicons
                        name={checks[c.key] ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={checks[c.key] ? colors.success : colors.textMuted}
                      />
                      <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.sheetButtons}>
                    <TouchableOpacity
                      style={[styles.sheetBtn, { backgroundColor: colors.border }, settleBusy && { opacity: 0.6 }]}
                      onPress={saveDraft}
                      disabled={settleBusy}
                    >
                      <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Save Draft</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sheetBtn,
                        { backgroundColor: colors.success, flex: 2 },
                        (!checklistDone || settleBusy) && { opacity: 0.5 },
                      ]}
                      onPress={handleCompleteCheckout}
                      disabled={settleBusy}
                    >
                      {settleBusy ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={[typography.caption, styles.actionText]}>Complete Checkout</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
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
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
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
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  actionText: { color: colors.white, fontWeight: '700', marginLeft: 6 },
  cancelButton: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
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
  sheetButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sheetBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  clearanceBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sumRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  sumDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2 },
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
    minHeight: 48,
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