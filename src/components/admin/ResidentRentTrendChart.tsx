import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminPaymentRecord } from '../../constants/mockData';
import { buildRentMonthRows, RentMonthRow } from './rentMonthHistory';

const CHART_HEIGHT = 160;

function timingColor(row: RentMonthRow): string {
  if (row.statusLabel === 'Late') return colors.error;
  return colors.success; // Early / On Time
}

export default function ResidentRentTrendChart({
  payments,
  dueDay,
  joiningDate,
}: {
  payments: AdminPaymentRecord[];
  dueDay: number;
  joiningDate: string;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const rows = buildRentMonthRows(joiningDate, dueDay, payments);
  // Only months with a known payment day are plotted — the current/future
  // "Pending" month has no day to plot yet, but still occupies its x-axis slot.
  const plottedRows = rows.filter((r) => r.statusLabel !== 'Pending');

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  if (rows.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
          Rent Payment Trend
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          Couldn't read joining date to build the trend.
        </Text>
      </View>
    );
  }

  const avgDay =
    plottedRows.length > 0
      ? Math.round(plottedRows.reduce((sum, r) => sum + r.day, 0) / plottedRows.length)
      : dueDay;

  if (plottedRows.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={[typography.heading3, { color: colors.text }]}>
          Rent Payment Trend (since joining)
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          Joined {joiningDate}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
          No payment history yet to show a trend.
        </Text>
      </View>
    );
  }

  const allDays = [...plottedRows.map((r) => r.day), dueDay];
  const minDay = Math.max(1, Math.min(...allDays) - 3);
  const maxDay = Math.min(31, Math.max(...allDays) + 3);
  const range = Math.max(1, maxDay - minDay);

  const dayToY = (day: number) => CHART_HEIGHT - ((day - minDay) / range) * CHART_HEIGHT;

  const chartContentWidth = containerWidth;
  const slotWidth = rows.length > 0 ? chartContentWidth / rows.length : 0;

  const slotIndexByMonthKey = new Map(rows.map((r, i) => [r.monthKey, i]));
  const xForMonthKey = (monthKey: number) => {
    const idx = slotIndexByMonthKey.get(monthKey) ?? 0;
    return slotWidth * idx + slotWidth / 2;
  };

  const coords = plottedRows.map((r) => ({
    x: xForMonthKey(r.monthKey),
    y: dayToY(r.day),
  }));

  const dueY = dayToY(dueDay);

  let trendNote = '';
  if (plottedRows.length >= 4) {
    const half = Math.floor(plottedRows.length / 2);
    const firstAvg = plottedRows.slice(0, half).reduce((s, r) => s + r.day, 0) / half;
    const secondAvg = plottedRows.slice(-half).reduce((s, r) => s + r.day, 0) / half;
    const diff = secondAvg - firstAvg;
    if (diff >= 2) trendNote = ' — trending later each month';
    else if (diff <= -2) trendNote = ' — trending earlier each month';
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[typography.heading3, { color: colors.text }]}>
        Rent Payment Trend (since joining)
      </Text>
      <View style={styles.headerInfoRow}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Joined {joiningDate}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Avg. payment day: {avgDay}</Text>
      </View>

      <View onLayout={onLayout} style={{ marginTop: spacing.sm }}>
        {containerWidth > 0 && (
          <View style={[styles.chartBox, { width: chartContentWidth }]}>
            <View style={[styles.dueLine, { top: dueY }]} />
            <Text style={[typography.caption, styles.dueLabel, { top: Math.max(0, dueY - 16) }]}>
              Due: day {dueDay}
            </Text>

            {coords.slice(1).map((c, i) => {
              const prev = coords[i];
              const dx = c.x - prev.x;
              const dy = c.y - prev.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <View
                  key={`line-${i}`}
                  style={[
                    styles.connectLine,
                    { width: length, left: prev.x, top: prev.y, transform: [{ rotate: `${angle}deg` }] },
                  ]}
                />
              );
            })}

            {plottedRows.map((r, i) => (
              <React.Fragment key={`pt-${i}`}>
                <Text
                  style={[
                    typography.caption,
                    styles.dayLabel,
                    { left: coords[i].x - 10, top: Math.max(0, coords[i].y - 22) },
                  ]}
                >
                  {r.day}
                </Text>
                <View
                  style={[
                    styles.dot,
                    { left: coords[i].x - 5, top: coords[i].y - 5, backgroundColor: timingColor(r) },
                  ]}
                />
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {containerWidth > 0 && (
        <View style={[styles.xAxisRow, { width: chartContentWidth }]}>
          {rows.map((r) => (
            <View key={`label-${r.monthKey}`} style={{ width: slotWidth }}>
              <Text
                style={[typography.caption, { color: colors.textMuted, textAlign: 'center', fontSize: 10 }]}
                numberOfLines={1}
              >
                {r.monthShort}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
        On average, pays around day {avgDay} of the month{trendNote}.
      </Text>
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
  headerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  chartBox: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  dueLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
  },
  dueLabel: {
    position: 'absolute',
    right: 0,
    color: colors.textMuted,
  },
  connectLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary,
    transformOrigin: '0 0',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dayLabel: {
    position: 'absolute',
    width: 20,
    textAlign: 'center',
    color: colors.text,
  },
  xAxisRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});