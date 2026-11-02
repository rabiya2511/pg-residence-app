import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

type Props = {
  pgName: string;
  room: string;
  bed: string;
  monthlyRent: number;
  nextDueDate: string;
  stayStatus: string;
  // Optional, so any other screen that uses this card keeps working unchanged.
  floor?: string;
  checkInDate?: string;
};

export default function StayOverviewCard({
  pgName,
  room,
  bed,
  monthlyRent,
  nextDueDate,
  stayStatus,
  floor,
  checkInDate,
}: Props) {
  // "bed" holds the room's sharing type (e.g. "3 Sharing"), so it is not labelled "Bed".
  const roomLine = [room ? `Room: ${room}` : '', floor || ''].filter(Boolean).join('  ·  ');
  const stayLine = [bed || '', checkInDate ? `Check-in: ${checkInDate}` : '']
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View style={styles.card}>
      <Text style={[typography.caption, styles.label]}>My Stay</Text>
      <Text style={[typography.heading3, { color: colors.white }]}>{pgName}</Text>
      {!!roomLine && <Text style={[typography.body, styles.subLabel]}>{roomLine}</Text>}
      {!!stayLine && <Text style={[typography.body, styles.subLabel]}>{stayLine}</Text>}

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.statBlock}>
          <Text style={[typography.caption, styles.label]}>Monthly Rent</Text>
          <Text style={[typography.heading3, { color: colors.white }]}>₹{monthlyRent.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[typography.caption, styles.label]}>Next Due</Text>
          <Text style={[typography.heading3, { color: colors.white }]}>{nextDueDate}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[typography.caption, styles.label]}>Status</Text>
          <Text style={[typography.heading3, { color: colors.white }]}>{stayStatus}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  subLabel: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBlock: {
    flex: 1,
  },
});