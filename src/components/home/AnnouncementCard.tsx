import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { Announcement } from '../../constants/mockData';

type Props = {
  announcement: Announcement;
};

export default function AnnouncementCard({ announcement }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={announcement.icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{announcement.title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{announcement.date}</Text>
        </View>
        <Text style={[typography.caption, styles.description]} numberOfLines={2}>
          {announcement.description}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  description: {
    color: colors.textMuted,
    marginTop: 2,
  },
});

