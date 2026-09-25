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
};

export default function RentStatusCard({ amount, monthLabel, dueInDays, status }: Props) {
  const navigation = useNavigation();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[typography.heading3, { color: colors.text }]}>Rent Status</Text>
        <View style={styles.statusBadge}>
          <Text style={[typography.caption, { color: colors.warning }]}>{status}</Text>
        </View>
      </View>

      <Text style={[typography.heading1, { color: colors.text, marginTop: spacing.sm }]}>
        ₹{amount}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>{monthLabel}</Text>
      <Text style={[typography.caption, { color: colors.error, marginTop: 4 }]}>
        Due in {dueInDays} days
      </Text>

      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('RentDetails' as never)}
      >
        <Text style={[typography.button, { color: colors.white }]}>View Details</Text>
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
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});