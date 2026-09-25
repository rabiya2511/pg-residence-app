import React, { useState } from 'react';
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

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

export default function VacateNoticeScreen() {
  const navigation = useNavigation();
  const { residents, submitVacateNotice } = useAdmin();
  const { residentId } = useMockAuth();

  const resident = residents.find((r) => r.id === residentId);

  const today = new Date();
  const minAllowedDate = addOneCalendarMonth(today);

  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(minAllowedDate);
  const [showPicker, setShowPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(!!resident?.vacatingDate);

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
    if (!residentId || !resident) return;

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

    if (isEmergency && !reason.trim()) {
      Alert.alert('Reason Required', 'Please explain why you need to vacate early.');
      return;
    }

    const dateLabel = formatDisplayDate(selectedDate);

    submitVacateNotice(residentId, dateLabel, isEmergency, reason.trim() || null);

    setSubmitted(true);

    if (isEmergency && previewDeductionPercent !== null) {
      Alert.alert(
        'Emergency Notice Submitted',
        `Your vacating date (${dateLabel}) has been sent to the admin. A ${previewDeductionPercent}% deduction (₹${previewDeductionAmount}) will apply to your security deposit due to the short notice.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Notice Submitted', `Your vacating date (${dateLabel}) has been sent to the admin.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleCancelNotice = () => {
    if (!residentId) return;
    Alert.alert('Cancel Vacate Notice', 'Are you sure you want to withdraw this notice?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel It',
        style: 'destructive',
        onPress: () => {
          submitVacateNotice(residentId, null);
          setSubmitted(false);
        },
      },
    ]);
  };

  if (!resident) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Vacate Notice</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {submitted && resident.vacatingDate ? (
          <View style={styles.submittedCard}>
            <Ionicons
              name={resident.emergencyVacateDeductionPercent ? 'warning' : 'checkmark-circle'}
              size={40}
              color={resident.emergencyVacateDeductionPercent ? colors.warning : colors.success}
              style={{ marginBottom: spacing.sm }}
            />
            <Text style={[typography.heading3, { color: colors.text, textAlign: 'center' }]}>
              {resident.emergencyVacateDeductionPercent ? 'Emergency Notice Submitted' : 'Notice Already Submitted'}
            </Text>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
              You're scheduled to vacate on {resident.vacatingDate}.
            </Text>
            {resident.emergencyVacateDeductionPercent !== null && (
              <Text style={[typography.bodyBold, { color: colors.warning, textAlign: 'center', marginTop: spacing.sm }]}>
                {resident.emergencyVacateDeductionPercent}% deposit deduction applies
              </Text>
            )}
            {resident.vacateReason && (
              <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
                Reason: {resident.vacateReason}
              </Text>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelNotice}>
              <Text style={[typography.button, { color: colors.error }]}>Cancel Notice</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.emergencyToggleRow}>
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
                : "Please give at least 1 month's notice before your vacating date. The admin will be notified immediately once you submit."}
            </Text>

            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              Vacating Date
            </Text>
            <TouchableOpacity style={styles.dateInput} activeOpacity={0.7} onPress={() => setShowPicker(true)}>
              <Text style={[typography.body, { color: colors.text }]}>{formatDisplayDate(selectedDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                minimumDate={pickerMinDate}
              />
            )}

            {isEmergency && (
              <>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md }]}>
                  Reason for Vacating
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Family emergency, job relocation..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                {previewDeductionPercent !== null && (
                  <View style={styles.deductionPreviewCard}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {daysNotice} day{daysNotice !== 1 ? 's' : ''} notice · Deposit deduction
                      </Text>
                      <Text style={[typography.bodyBold, { color: colors.warning, marginTop: 2 }]}>
                        {previewDeductionPercent}% (₹{previewDeductionAmount} of ₹{resident.securityDeposit})
                      </Text>
                    </View>
                  </View>
                )}
              </>
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
    backgroundColor: colors.white,
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
    marginTop: spacing.xl,
  },
  cancelButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});