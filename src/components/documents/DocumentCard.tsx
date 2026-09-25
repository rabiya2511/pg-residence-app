import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { ResidentDocument, DocumentStatus } from '../../constants/mockData';

const statusStyles: Record<DocumentStatus, { bg: string; text: string; icon: string }> = {
  Uploaded: { bg: '#D1FAE5', text: colors.success, icon: 'checkmark-circle' },
  Pending: { bg: '#FEF3C7', text: colors.warning, icon: 'time' },
  Rejected: { bg: '#FEE2E2', text: colors.error, icon: 'close-circle' },
};

type Props = {
  document: ResidentDocument;
};

export default function DocumentCard({ document }: Props) {
  const statusStyle = statusStyles[document.status];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{document.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {document.description}
          </Text>
          {document.uploadedOn && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Uploaded on {document.uploadedOn}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
          <Ionicons name={statusStyle.icon as any} size={12} color={statusStyle.text} />
          <Text style={[typography.caption, { color: statusStyle.text, marginLeft: 4 }]}>
            {document.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
});