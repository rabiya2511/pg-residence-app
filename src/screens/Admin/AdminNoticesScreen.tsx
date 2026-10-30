import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAnnouncements, NoticeWithExpiry } from '../../context/AnnouncementsContext';

function expiryLabel(expiresAt?: number) {
  if (!expiresAt) return null;
  const days = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Clears today';
  return `Auto-clears in ${days} day${days === 1 ? '' : 's'}`;
}

function NoticeCard({ notice, onDelete }: { notice: NoticeWithExpiry; onDelete: () => void }) {
  const expiry = expiryLabel(notice.expiresAt);
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={notice.icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{notice.title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
            {notice.date}
          </Text>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={{ marginLeft: spacing.sm }}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
        <Text style={[typography.body, styles.description]}>{notice.description}</Text>
        {!!expiry && (
          <View style={styles.expiryRow}>
            <Ionicons name="time-outline" size={13} color={colors.warning} />
            <Text style={[typography.caption, { color: colors.warning, marginLeft: 4 }]}>{expiry}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function AdminNoticesScreen() {
  const { announcements, addAnnouncement, deleteAnnouncement, clearAllAnnouncements } = useAnnouncements();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [autoClear, setAutoClear] = useState(false);

  const handleSend = () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please enter both a title and a message.');
      return;
    }
    addAnnouncement(
      {
        title: title.trim(),
        description: description.trim(),
        icon: 'megaphone-outline',
      },
      autoClear ? { autoClearAfterDays: 7 } : undefined
    );
    setTitle('');
    setDescription('');
    setAutoClear(false);
    Alert.alert(
      'Sent',
      autoClear
        ? 'Your notice has been sent to all residents and will clear automatically after 1 week.'
        : 'Your notice has been sent to all residents.'
    );
  };

  const confirmDelete = (n: NoticeWithExpiry) =>
    Alert.alert('Delete Notice', `Delete "${n.title}"? Residents will no longer see it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAnnouncement(n.id) },
    ]);

  const confirmClearAll = () =>
    Alert.alert('Clear All Notices', `Delete all ${announcements.length} notices? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => clearAllAnnouncements() },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.heading2, { color: colors.text }]}>Notices</Text>
        <View style={styles.headerRight}>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {announcements.length} sent
          </Text>
          {announcements.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={confirmClearAll} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 4 }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.composeCard}>
        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.descInput}
          placeholder="Write a message for all residents..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
        <View style={styles.autoClearRow}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>Auto-clear after 1 week</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              The notice is removed automatically 7 days after sending.
            </Text>
          </View>
          <Switch
            value={autoClear}
            onValueChange={setAutoClear}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
        <TouchableOpacity style={styles.sendButton} activeOpacity={0.85} onPress={handleSend}>
          <Ionicons name="send" size={16} color={colors.white} />
          <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>
            Send to All Residents
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <NoticeCard notice={item} onDelete={() => confirmDelete(item)} />}
        ListHeaderComponent={
          <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
            Sent Notices
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  composeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  descInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: spacing.sm,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
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
    alignItems: 'flex-start',
  },
  description: {
    color: colors.textMuted,
    marginTop: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  autoClearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});