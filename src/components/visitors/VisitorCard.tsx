import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { VisitorLog } from '../../constants/mockData';

type Props = {
  visitor: VisitorLog;
  onCheckOut?: () => void;
};

export default function VisitorCard({ visitor, onCheckOut }: Props) {
  const isCheckedIn = visitor.status === 'Checked In';
  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarInitial}>{visitor.visitorName.charAt(0)}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{visitor.visitorName}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: isCheckedIn ? '#D1FAE5' : colors.background },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: isCheckedIn ? colors.success : colors.textMuted },
              ]}
            >
              {visitor.status}
            </Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {visitor.purpose}
        </Text>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]}>
            {visitor.checkInTime}
            {visitor.checkOutTime ? ` – ${visitor.checkOutTime}` : ' (still inside)'}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {visitor.date}
        </Text>
        {isCheckedIn && onCheckOut && (
          <TouchableOpacity style={styles.checkOutButton} onPress={onCheckOut} activeOpacity={0.8}>
            <Text style={[typography.caption, { color: colors.white, fontWeight: '600' }]}>
              Check Out
            </Text>
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
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    flex: 1,
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  checkOutButton: {
    backgroundColor: colors.error,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});