import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { VisitorRequest, VisitorStatus } from '../../context/VisitorsContext';
import { passCodeOf, passPayload } from '../../utils/visitorPass';

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
  const [showPass, setShowPass] = useState(false);
  const hasPass = visitor.status === 'Approved' || visitor.status === 'Checked In';
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

        {hasPass && (
          <TouchableOpacity style={styles.passButton} onPress={() => setShowPass(true)} activeOpacity={0.85}>
            <Ionicons name="qr-code-outline" size={16} color={colors.white} />
            <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
              Show entry pass
            </Text>
          </TouchableOpacity>
        )}

        {canCancel && onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.8}>
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showPass} transparent animationType="fade" onRequestClose={() => setShowPass(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPass(false)}>
          <View style={styles.passSheet}>
            <Text style={[typography.heading3, { color: colors.text }]}>Visitor Entry Pass</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Show this at the gate
            </Text>
            <View style={styles.qrBox}>
              <QRCode value={passPayload(visitor.id)} size={190} />
            </View>
            <Text style={styles.passCode}>{passCodeOf(visitor.id)}</Text>
            <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.sm }]}>{visitor.visitorName}</Text>
            {!!when && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{when}</Text>}
            {visitor.numVisitors > 1 && (
              <Text style={[typography.caption, { color: colors.textMuted }]}>{visitor.numVisitors} visitors</Text>
            )}
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>Tap anywhere to close</Text>
          </View>
        </TouchableOpacity>
      </Modal>
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
  passButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  passSheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', alignSelf: 'stretch' },
  qrBox: { backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  passCode: { fontSize: 26, fontWeight: '800', letterSpacing: 4, color: colors.text, marginTop: spacing.md },
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