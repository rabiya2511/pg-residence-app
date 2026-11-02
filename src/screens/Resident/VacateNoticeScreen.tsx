import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { getEmergencyVacateDeductionPercent } from '../../constants/mockData';
import { computeSettlement, exitStatusOf, heldDeposit, parseDisplayDate, pendingRentFor } from '../../utils/exitSettlement';

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Adds exactly one calendar month to a date (e.g. 22 Sep -> 22 Oct, 31 Jan ->
// 28/29 Feb), rather than a fixed 30-day offset which drifts across months
// of different lengths.
function addOneCalendarMonth(date: Date): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + 1);
  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }
  return result;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

function InfoRow({ label, value, negative, bold }: { label: string; value: string; negative?: boolean; bold?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[bold ? typography.bodyBold : typography.caption, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text
        style={[
          bold ? typography.bodyBold : typography.caption,
          { color: negative ? colors.error : colors.text, fontWeight: '600', marginLeft: spacing.sm, flexShrink: 1, textAlign: 'right' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function VacateNoticeScreen() {
  const navigation = useNavigation();
  const { residents, rooms, paymentRecords, submitVacateNotice } = useAdmin();
  const { residentId } = useMockAuth();

  const resident = residents.find((r) => r.id === residentId);
  const room = rooms.find((r) => r.id === resident?.roomId);

  const today = new Date();
  const minAllowedDate = addOneCalendarMonth(today);

  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(minAllowedDate);
  const [showPicker, setShowPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const sendingRef = useRef(false); // blocks a second tap while the first is being sent

  // In emergency mode, any date from today onward is selectable — the whole
  // point is bypassing the 1-month notice period, at the cost of a deposit
  // deduction. In normal mode, the usual 1-month minimum still applies.
  const pickerMinDate = isEmergency ? today : minAllowedDate;

  const handleToggleEmergency = (value: boolean) => {
    setIsEmergency(value);
    // Reset the selected date to a sensible default for the newly chosen
    // mode, since the two modes have very different valid ranges.
    setSelectedDate(value ? today : minAllowedDate);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) setSelectedDate(date);
  };

  const daysNotice = Math.max(0, daysBetween(today, selectedDate));
  const previewDeductionPercent = isEmergency ? getEmergencyVacateDeductionPercent(daysNotice) : null;
  const previewDeductionAmount =
    previewDeductionPercent !== null && resident
      ? Math.round((resident.securityDeposit * previewDeductionPercent) / 100)
      : null;

  const handleSubmit = () => {
    if (!residentId || !resident || sendingRef.current) return;

    if (!isEmergency && selectedDate.getTime() < minAllowedDate.getTime()) {
      Alert.alert(
        'Notice Period Required',
        `Please choose a date at least 1 month from today (on or after ${formatDisplayDate(minAllowedDate)}), or use Emergency Vacate instead.`
      );
      return;
    }

    if (isEmergency && selectedDate.getTime() < today.getTime()) {
      Alert.alert('Invalid Date', 'Please choose today or a future date.');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please tell us why you are leaving.');
      return;
    }

    const dateLabel = formatDisplayDate(selectedDate);

    sendingRef.current = true;
    submitVacateNotice(residentId, dateLabel, isEmergency, reason.trim(), remarks.trim() || null);

    if (isEmergency && previewDeductionPercent !== null) {
      Alert.alert(
        'Emergency Notice Submitted',
        `Your vacating date (${dateLabel}) has been sent to the admin for approval. A ${previewDeductionPercent}% deduction (${formatINR(previewDeductionAmount ?? 0)}) will apply to your security deposit due to the short notice.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Notice Submitted', `Your vacating date (${dateLabel}) has been sent to the admin for approval.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  // Withdrawing (or starting over after a rejection) clears the notice.
  const clearNotice = () => {
    if (!residentId) return;
    submitVacateNotice(residentId, null);
    sendingRef.current = false;
    setReason('');
    setRemarks('');
  };

  const handleCancelNotice = () => {
    Alert.alert('Cancel Vacate Notice', 'Are you sure you want to withdraw this notice?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel It', style: 'destructive', onPress: clearNotice },
    ]);
  };

  if (!resident) return null;

  const r: any = resident;
  const status = exitStatusOf(resident);
  const hasNotice = !!resident.vacatingDate;

  // Figures for the status card.
  const submittedTs = Number(r.vacateSubmittedAt) || 0;
  const vacateDateObj = parseDisplayDate(resident.vacatingDate ?? '');
  const noticeGiven =
    submittedTs && vacateDateObj ? Math.max(0, daysBetween(new Date(submittedTs), vacateDateObj)) : null;
  const rejectReason: string | null = status === 'Rejected' ? r.exitDecision?.reason ?? null : null;
  const draft = r.exitDraft ?? {};
  const settlement = computeSettlement({
    deposit: heldDeposit(resident),
    emergencyPercent: resident.emergencyVacateDeductionPercent,
    pendingRent: pendingRentFor(resident.id, paymentRecords),
    additional: Number(draft.additional) || 0,
    pendingMaintenance: Number(draft.pendingMaintenance) || 0,
    advanceCredit: Number(draft.advanceCredit) || 0,
  });

  const statusLook =
    status === 'Approved'
      ? { icon: 'checkmark-circle' as const, color: colors.success, title: 'Exit Notice Approved' }
      : status === 'Rejected'
      ? { icon: 'close-circle' as const, color: colors.error, title: 'Exit Notice Rejected' }
      : { icon: 'time' as const, color: colors.warning, title: 'Waiting for Admin Approval' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Exit Notice</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hasNotice ? (
          <>
            <View style={styles.submittedCard}>
              <Ionicons name={statusLook.icon} size={40} color={statusLook.color} style={{ marginBottom: spacing.sm }} />
              <Text style={[typography.heading3, { color: colors.text, textAlign: 'center' }]}>{statusLook.title}</Text>
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
                {status === 'Pending'
                  ? `You asked to vacate on ${resident.vacatingDate}. The admin will review it shortly.`
                  : status === 'Approved'
                  ? `You are scheduled to vacate on ${resident.vacatingDate}.`
                  : `Your request to vacate on ${resident.vacatingDate} was not approved.`}
              </Text>

              {!!rejectReason && (
                <View style={styles.rejectBox}>
                  <Text style={[typography.caption, { color: colors.error }]}>Admin note: {rejectReason}</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <InfoRow label="Resident" value={resident.name} />
                <InfoRow label="Room" value={room?.roomNumber ?? '—'} />
                <InfoRow label="Notice submitted" value={submittedTs ? formatDisplayDate(new Date(submittedTs)) : '—'} />
                <InfoRow label="Expected checkout" value={resident.vacatingDate ?? '—'} />
                {noticeGiven !== null && (
                  <InfoRow label="Notice period given" value={`${noticeGiven} day${noticeGiven === 1 ? '' : 's'}`} />
                )}
                {!!resident.vacateReason && <InfoRow label="Reason" value={resident.vacateReason} />}
                {!!r.vacateRemarks && <InfoRow label="Remarks" value={r.vacateRemarks} />}
              </View>

              {resident.emergencyVacateDeductionPercent !== null && resident.emergencyVacateDeductionPercent !== undefined && (
                <Text style={[typography.bodyBold, { color: colors.warning, textAlign: 'center', marginTop: spacing.sm }]}>
                  Emergency vacate · {resident.emergencyVacateDeductionPercent}% deposit deduction applies
                </Text>
              )}

              {status === 'Approved' && (
                <View style={styles.infoBox}>
                  <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.xs }]}>
                    Estimated settlement
                  </Text>
                  <InfoRow label="Security deposit" value={formatINR(settlement.deposit)} />
                  {settlement.emergencyDeduction > 0 && (
                    <InfoRow label="Emergency deduction" value={`− ${formatINR(settlement.emergencyDeduction)}`} negative />
                  )}
                  {settlement.pendingRent > 0 && (
                    <InfoRow label="Pending rent" value={`− ${formatINR(settlement.pendingRent)}`} negative />
                  )}
                  {settlement.additional > 0 && (
                    <InfoRow
                      label={draft.note ? `Other deductions (${draft.note})` : 'Other deductions'}
                      value={`− ${formatINR(settlement.additional)}`}
                      negative
                    />
                  )}
                  <View style={styles.divider} />
                  {settlement.amountOwed > 0 ? (
                    <InfoRow label="You owe" value={formatINR(settlement.amountOwed)} negative bold />
                  ) : (
                    <InfoRow label="Estimated refund" value={formatINR(settlement.refund)} bold />
                  )}
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    The final amount is confirmed by the admin at checkout, after the room inspection.
                  </Text>
                </View>
              )}

              {status === 'Pending' && (
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelNotice}>
                  <Text style={[typography.button, { color: colors.error }]}>Cancel Notice</Text>
                </TouchableOpacity>
              )}
              {status === 'Approved' && (
                <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>
                  To change or cancel an approved notice, please contact your PG admin.
                </Text>
              )}
              {status === 'Rejected' && (
                <TouchableOpacity style={[styles.submitButton, { alignSelf: 'stretch' }]} onPress={clearNotice}>
                  <Text style={[typography.button, { color: colors.white }]}>Submit a New Notice</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoBox}>
              <InfoRow label="Resident" value={resident.name} />
              <InfoRow label="Room" value={room?.roomNumber ?? '—'} />
              <InfoRow label="Notice date" value={formatDisplayDate(today)} />
              <InfoRow label="Notice period" value="1 month" />
            </View>

            <View style={[styles.emergencyToggleRow, { marginTop: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>Emergency Vacate</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  Vacate before the 1-month notice period, with a deposit deduction
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.switchTrack, isEmergency && styles.switchTrackActive]}
                activeOpacity={0.8}
                onPress={() => handleToggleEmergency(!isEmergency)}
              >
                <View style={[styles.switchThumb, isEmergency && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
              {isEmergency
                ? 'Choose your vacating date below. The shorter the notice, the higher the deduction from your security deposit.'
                : "Please give at least 1 month's notice before your vacating date. The admin will be notified immediately and will approve your notice."}
            </Text>

            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Expected Checkout Date
            </Text>
            <TouchableOpacity style={styles.dateInput} activeOpacity={0.7} onPress={() => setShowPicker(true)}>
              <Text style={[typography.body, { color: colors.text }]}>{formatDisplayDate(selectedDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
              {daysNotice} day{daysNotice === 1 ? '' : 's'} of notice
            </Text>

            {showPicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                minimumDate={pickerMinDate}
              />
            )}

            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md }]}>
              Reason for Leaving *
            </Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder={isEmergency ? 'e.g. Family emergency, job relocation...' : 'e.g. Job transfer, course completed...'}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md }]}>
              Remarks (optional)
            </Text>
            <TextInput
              style={styles.reasonInput}
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Anything else the admin should know"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            {isEmergency && previewDeductionPercent !== null && (
              <View style={styles.deductionPreviewCard}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {daysNotice} day{daysNotice !== 1 ? 's' : ''} notice · Deposit deduction
                  </Text>
                  <Text style={[typography.bodyBold, { color: colors.warning, marginTop: 2 }]}>
                    {previewDeductionPercent}% ({formatINR(previewDeductionAmount ?? 0)} of {formatINR(resident.securityDeposit)})
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isEmergency && styles.submitButtonEmergency]}
              activeOpacity={0.85}
              onPress={handleSubmit}
            >
              <Text style={[typography.button, { color: colors.white }]}>
                {isEmergency ? 'Submit Emergency Notice' : 'Submit Notice'}
              </Text>
            </TouchableOpacity>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  infoBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  rejectBox: {
    alignSelf: 'stretch',
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  emergencyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
    marginLeft: spacing.sm,
  },
  switchTrackActive: {
    backgroundColor: colors.warning,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  reasonInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  deductionPreviewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonEmergency: {
    backgroundColor: colors.warning,
  },
  submittedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});