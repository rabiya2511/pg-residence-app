import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useNoticeReads } from '../../utils/noticeReads';
import { categoryOf } from '../../constants/noticeCategories';

// Notifications are the live notices the admin publishes (no sample data), with the
// same read / unread state as the Notices screen and the bell on Home.
export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { announcements } = useAnnouncements();
  const { residentId } = useMockAuth();
  const { isRead, markRead, markAllRead } = useNoticeReads(residentId ?? null);

  const unreadCount = announcements.filter((a) => !isRead(a.id)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        <TouchableOpacity
          onPress={() => markAllRead(announcements.map((a) => a.id))}
          disabled={unreadCount === 0}
          style={[styles.backButton, unreadCount === 0 && { opacity: 0.3 }]}
          hitSlop={8}
        >
          <Ionicons name="checkmark-done" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {announcements.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No notifications yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const unread = !isRead(item.id);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => markRead(item.id)}
                style={[styles.row, unread && styles.rowUnread]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={(item.icon || categoryOf(item).icon) as any} size={20} color={colors.primary} />
                </View>
                <View style={styles.content}>
                  <View style={styles.headerRow}>
                    <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{item.title}</Text>
                    {unread && <View style={styles.dot} />}
                  </View>
                  <Text style={[typography.body, styles.body]} numberOfLines={unread ? 3 : 6}>
                    {item.description}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    {categoryOf(item).label} · {item.date}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.xs },
  body: { color: colors.textMuted, marginTop: 2 },
});