import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminPaymentRecord } from '../../constants/mockData';
import { buildRentMonthRows, RentMonthRow } from './rentMonthHistory';

function statusStyle(row: RentMonthRow): { bg: string; text: string } {
  if (row.statusLabel === 'Late') return { bg: '#FEE2E2', text: colors.error };
  if (row.statusLabel === 'Pending') return { bg: '#FEF3C7', text: colors.warning };
  return { bg: '#D1FAE5', text: colors.success }; // Early / On Time
}

function formatDMY(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ResidentMonthlyRentHistory({
  joiningDate,
  rentDueDay,
  payments,
}: {
  joiningDate: string;
  rentDueDay: number;
  payments: AdminPaymentRecord[];
}) {
  const rows = buildRentMonthRows(joiningDate, rentDueDay, payments);

  if (rows.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={[typography.heading3, { color: colors.text }]}>Monthly Rent History</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Couldn't read joining date to build history.
        </Text>
      </View>
    );
  }

  const displayRows = [...rows].reverse(); // most recent first

  return (
    <View style={styles.wrapper}>
      <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
        Monthly Rent History (since joining)
      </Text>

      {displayRows.map((row) => {
        const style = statusStyle(row);
        const displayDateText =
          row.statusLabel === 'Pending'
            ? `Due on day ${row.dueDateObj.getDate()}`
            : row.record?.paidOn
            ? `Paid on ${row.record.paidOn}`
            : `Paid on ${formatDMY(row.dueDateObj)}`;

        return (
          <View key={row.monthKey} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{row.label}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{displayDateText}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: style.bg }]}>
              <Text style={[typography.caption, { color: style.text }]}>{row.statusLabel}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
});