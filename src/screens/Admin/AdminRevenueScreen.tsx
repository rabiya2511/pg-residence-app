import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { revenueHistory } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

const CHART_HEIGHT = 160;

export default function AdminRevenueScreen() {
  const navigation = useNavigation();
  const { residents } = useAdmin();

  const maxAmount = Math.max(...revenueHistory.map((m) => m.amount));
  const totalRevenue = revenueHistory.reduce((sum, m) => sum + m.amount, 0);
  const avgRevenue = Math.round(totalRevenue / revenueHistory.length);
  const currentMonth = revenueHistory[revenueHistory.length - 1];
  const previousMonth = revenueHistory[revenueHistory.length - 2];
  const change = previousMonth
    ? Math.round(((currentMonth.amount - previousMonth.amount) / previousMonth.amount) * 100)
    : 0;

  const overallAmount = residents.reduce((sum, r) => sum + r.monthlyRent, 0);
  const collectedAmount = residents
    .filter((r) => r.rentStatus === 'Paid')
    .reduce((sum, r) => sum + r.monthlyRent, 0);
  const dueAmount = residents
    .filter((r) => r.rentStatus === 'Pending' || r.rentStatus === 'Overdue')
    .reduce((sum, r) => sum + r.monthlyRent, 0);
  const collectedPercent = overallAmount > 0 ? Math.round((collectedAmount / overallAmount) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Monthly Revenue</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={[typography.caption, { color: 'rgba(255,255,255,0.75)' }]}>
            {currentMonth.month} Revenue
          </Text>
          <Text style={[typography.heading1, { color: colors.white, marginTop: 4 }]}>
            ₹{currentMonth.amount.toLocaleString()}
          </Text>
          <View style={styles.changeRow}>
            <Ionicons
              name={change >= 0 ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={colors.white}
            />
            <Text style={[typography.caption, { color: colors.white, marginLeft: 4 }]}>
              {Math.abs(change)}% vs last month
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Total (6 mo)</Text>
            <Text style={[typography.heading3, { color: colors.text }]}>
              ₹{totalRevenue.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Average</Text>
            <Text style={[typography.heading3, { color: colors.text }]}>
              ₹{avgRevenue.toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>
          Collection Status
        </Text>

        <View style={styles.collectionCard}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${collectedPercent}%` }]} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {collectedPercent}% collected this month
          </Text>

          <View style={styles.collectionRow}>
            <View style={styles.collectionItem}>
              <View style={[styles.collectionDot, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Overall</Text>
                <Text style={[typography.bodyBold, { color: colors.text }]}>
                  ₹{overallAmount.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.collectionItem}>
              <View style={[styles.collectionDot, { backgroundColor: colors.success }]} />
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Collected</Text>
                <Text style={[typography.bodyBold, { color: colors.success }]}>
                  ₹{collectedAmount.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.collectionItem}>
              <View style={[styles.collectionDot, { backgroundColor: colors.error }]} />
              <View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Dues</Text>
                <Text style={[typography.bodyBold, { color: colors.error }]}>
                  ₹{dueAmount.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>
          Trend
        </Text>

        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {revenueHistory.map((entry) => {
              const barHeight = (entry.amount / maxAmount) * CHART_HEIGHT;
              const isLast = entry.month === currentMonth.month;
              return (
                <View key={entry.month} style={styles.barColumn}>
                  <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>
                    {(entry.amount / 1000).toFixed(0)}k
                  </Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: isLast ? colors.primary : colors.primaryLight,
                      },
                    ]}
                  />
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
                    {entry.month}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Monthly Breakdown
        </Text>
        {[...revenueHistory].reverse().map((entry) => (
          <View key={entry.month} style={styles.listRow}>
            <Text style={[typography.body, { color: colors.text }]}>{entry.month} 2026</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              ₹{entry.amount.toLocaleString()}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  collectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collectionDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 40,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: 24,
    borderRadius: radius.sm,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});