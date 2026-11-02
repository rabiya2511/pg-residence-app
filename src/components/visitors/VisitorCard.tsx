import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { VisitorRequest, VisitorStatus } from '../../context/VisitorsContext';

const STATUS_STYLE: Record<VisitorStatus, { label: string; bg: string; fg: string }> = {
  Pending: { label: 'Pending', bg: colors.amberBg, fg: '#92400E' },
  Approved: { label: 'Approved', bg: colors.successBg, fg: colors.success },
  Rejected: { label: 'Rejected', bg: colors.errorBg, fg: colors.error },
  Cancelled: { label: 'Cancelled', bg: colors.border, fg: colors.textMuted },
  'Checked In': { label: 'Inside', bg: colors.primaryLight, fg: colors.primary },
  'Checked Out': { label: 'Left', bg: colors.border, fg: colors.textMuted },
};

type Props = {
  visitor: VisitorRequest;
  onCancel?: () => void;
};

export default function VisitorCard({ visitor, onCancel }: Props) {
  const s = STATUS_STYLE[visitor.status] ?? STATUS_STYLE.Pending;
  const canCancel = visitor.status === 'Pending' || visitor.status === 'Approved';

  const when = [
    visitor.expectedDate,
    visitor.expectedArrival
      ? visitor.expectedDeparture
        ? `${visitor.expectedArrival} – ${visitor.expectedDeparture}`
        : visitor.expectedArrival
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarInitial}>{(visitor.visitorName || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1, marginRight: spacing.sm }]} numberOfLines={1}>
            {visitor.visitorName}
          </Text>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[typography.caption, { color: s.fg, fontWeight: '700' }]}>{s.label}</Text>
          </View>
        </View>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {[visitor.relationship, visitor.purpose].filter(Boolean).join(' · ')}
          {visitor.numVisitors > 1 ? ` · ${visitor.numVisitors} visitors` : ''}
        </Text>

        {!!when && (
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]}>{when}</Text>
          </View>
        )}

        {!!visitor.visitorPhone && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            Phone: {visitor.visitorPhone}
          </Text>
        )}
        {!!visitor.instructions && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            Note: {visitor.instructions}
          </Text>
        )}

        {visitor.status === 'Rejected' && (
          <View style={styles.rejectBox}>
            <Text style={[typography.caption, { color: colors.error }]}>
              {visitor.rejectReason ? `Rejected: ${visitor.rejectReason}` : 'Rejected by the admin.'}
            </Text>
          </View>
        )}

        {(visitor.checkInTime || visitor.checkOutTime) && visitor.status !== 'Pending' && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
            {visitor.checkInTime ? `Entered ${visitor.checkInTime}` : ''}
            {visitor.checkOutTime ? ` · Left ${visitor.checkOutTime}` : visitor.status === 'Checked In' ? ' · still inside' : ''}
          </Text>
        )}

        {canCancel && onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.8}>
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
  avatarInitial: { fontSize: 16, fontWeight: '700', color: colors.primary },
  content: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rejectBox: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
});