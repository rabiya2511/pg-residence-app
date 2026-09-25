import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { MaintenanceRequest, MaintenanceStatus } from '../../constants/mockData';

const statusStyles: Record<MaintenanceStatus, { bg: string; text: string }> = {
  Open: { bg: '#FEE2E2', text: colors.error },
  'In Progress': { bg: '#FEF3C7', text: colors.warning },
  Resolved: { bg: '#D1FAE5', text: colors.success },
};

const categoryIcons: Record<string, string> = {
  'AC / Cooling': 'snow-outline',
  Electrical: 'flash-outline',
  Plumbing: 'water-outline',
  Furniture: 'bed-outline',
  Appliance: 'hardware-chip-outline',
  Other: 'ellipsis-horizontal-outline',
};

type Props = {
  request: MaintenanceRequest;
};

export default function MaintenanceCard({ request }: Props) {
  const statusStyle = statusStyles[request.status];
  const icon = categoryIcons[request.category] || 'construct-outline';

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{request.category}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[typography.caption, { color: statusStyle.text }]}>
              {request.status}
            </Text>
          </View>
        </View>
        <Text style={[typography.body, styles.description]} numberOfLines={2}>
          {request.description}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
          {request.date}
        </Text>
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
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
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
  description: {
    color: colors.textMuted,
    marginTop: 2,
  },
});