import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { Announcement } from '../../constants/mockData';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useNoticeReads } from '../../utils/noticeReads';
import { NOTICE_CATEGORIES, categoryOf } from '../../constants/noticeCategories';

function NoticeCard({
  notice,
  unread,
  onPress,
  onImage,
}: {
  notice: Announcement & { pinned?: boolean; imageUri?: string };
  unread: boolean;
  onPress: () => void;
  onImage: (uri: string) => void;
}) {
  const category = categoryOf(notice);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.card, unread && styles.cardUnread]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={(notice.icon || category.icon) as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{notice.title}</Text>
          {!!notice.pinned && <Ionicons name="pin" size={14} color={colors.primary} style={{ marginLeft: spacing.xs }} />}
          {unread && <View style={styles.dot} />}
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
            {notice.date}
          </Text>
        </View>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{category.label}</Text>
        </View>
        <Text style={[typography.body, styles.description]}>{notice.description}</Text>
        {!!notice.imageUri && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onImage(notice.imageUri!)}>
            <Image source={{ uri: notice.imageUri }} style={styles.noticeImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function NoticesScreen() {
  const navigation = useNavigation<any>();
  const { announcements } = useAnnouncements();
  const { residentId } = useMockAuth();
  const { isRead, markRead, markAllRead } = useNoticeReads(residentId ?? null);
  const [filter, setFilter] = useState<string>('all');
  const [viewing, setViewing] = useState<string | null>(null);

  // Only categories that actually have a notice are offered as filters.
  const categories = useMemo(() => {
    const used = new Set(announcements.map((a) => categoryOf(a).id));
    return [{ id: 'all', label: 'All' }, ...NOTICE_CATEGORIES.filter((c) => used.has(c.id))];
  }, [announcements]);

  const visible = announcements.filter((a) => filter === 'all' || categoryOf(a).id === filter);
  const unreadCount = announcements.filter((a) => !isRead(a.id)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Notices</Text>
        <TouchableOpacity
          onPress={() => markAllRead(announcements.map((a) => a.id))}
          disabled={unreadCount === 0}
          style={[styles.backButton, unreadCount === 0 && { opacity: 0.3 }]}
          hitSlop={8}
        >
          <Ionicons name="checkmark-done" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {categories.length > 2 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {categories.map((c) => {
              const on = filter === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setFilter(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, on && { color: colors.white }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {visible.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="megaphone-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No notices at the moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <NoticeCard notice={item} unread={!isRead(item.id)} onPress={() => markRead(item.id)} onImage={setViewing} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewing(null)}>
          {!!viewing && <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
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
  chipRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.xs,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.xs },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  description: { color: colors.textMuted, marginTop: 4 },
  noticeImage: { width: '100%', height: 160, borderRadius: radius.md, marginTop: spacing.sm },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
});