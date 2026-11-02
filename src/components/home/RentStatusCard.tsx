import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

type Props = {
  amount: number;
  monthLabel: string;
  dueInDays: number;
  status: string;
  totalOutstanding?: number;
  lastPayment?: { amount: number; paidOn: string } | null;
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function RentStatusCard({
  amount,
  monthLabel,
  dueInDays,
  status,
  totalOutstanding = 0,
  lastPayment = null,
}: Props) {
  const navigation = useNavigation();

  const isPaid = status === 'Paid';
  const isOverdue = status === 'Overdue';

  const badgeBg = isPaid ? colors.successBg : isOverdue ? colors.errorBg : colors.amberBg;
  const badgeText = isPaid ? colors.success : isOverdue ? colors.error : colors.secondary;

  let dueText: string;
  if (isPaid) dueText = 'Paid for this month';
  else if (isOverdue) dueText = `Overdue by ${Math.abs(dueInDays)} day${Math.abs(dueInDays) === 1 ? '' : 's'}`;
  else if (dueInDays === 0) dueText = 'Due today';
  else dueText = `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'}`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[typography.heading3, { color: colors.text }]}>Rent Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
          <Text style={[typography.caption, { color: badgeText, fontWeight: '700' }]}>{status}</Text>
        </View>
      </View>

      <Text style={[typography.heading1, { color: colors.text, marginTop: spacing.sm }]}>
        {inr(amount)}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>{monthLabel}</Text>
      <Text
        style={[
          typography.caption,
          { color: isPaid ? colors.success : isOverdue ? colors.error : colors.textMuted, marginTop: 4, fontWeight: '600' },
        ]}
      >
        {dueText}
      </Text>

      {totalOutstanding > 0 && (
        <View style={styles.infoRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Total outstanding</Text>
          <Text style={[typography.bodyBold, { color: colors.error }]}>{inr(totalOutstanding)}</Text>
        </View>
      )}

      {!!lastPayment && (
        <View style={styles.infoRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Last payment</Text>
          <Text style={[typography.caption, { color: colors.text }]}>
            {inr(lastPayment.amount)}{lastPayment.paidOn ? ` · ${lastPayment.paidOn}` : ''}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('RentDetails' as never)}
      >
        <Text style={[typography.button, { color: colors.white }]}>
          {isPaid ? 'View Details' : 'Pay / View Details'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});