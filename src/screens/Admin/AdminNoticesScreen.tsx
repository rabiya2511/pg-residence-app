import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAnnouncements } from '../../context/AnnouncementsContext';
import { Announcement } from '../../constants/mockData';

function NoticeCard({ notice }: { notice: Announcement }) {
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
        </View>
        <Text style={[typography.body, styles.description]}>{notice.description}</Text>
      </View>
    </View>
  );
}

export default function AdminNoticesScreen() {
  const { announcements, addAnnouncement } = useAnnouncements();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSend = () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please enter both a title and a message.');
      return;
    }
    addAnnouncement({
      title: title.trim(),
      description: description.trim(),
      icon: 'megaphone-outline',
    });
    setTitle('');
    setDescription('');
    Alert.alert('Sent', 'Your notice has been sent to all residents.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.heading2, { color: colors.text }]}>Notices</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {announcements.length} sent
        </Text>
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
        renderItem={({ item }) => <NoticeCard notice={item} />}
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
});