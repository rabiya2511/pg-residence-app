import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useSupportTickets, TICKET_CATEGORIES, ticketColor, fmtWhen } from '../../hooks/useSupportTickets';

// No ticketId  -> "Raise a ticket" form.   With ticketId -> the ticket conversation.
export default function SupportChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const ticketId: string | undefined = route.params?.ticketId;
  const { tickets, createTicket, reply, reopen, close } = useSupportTickets();
  const ticket = tickets.find((t) => t.id === ticketId);

  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const header = (title: string) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[typography.heading3, { color: colors.text }]}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission Needed', 'Allow camera access in your phone settings to take a photo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!res.canceled) setPhoto(res.assets?.[0]?.uri ?? null);
    } catch (e: any) {
      console.warn('camera failed:', e?.message ?? e);
      Alert.alert('Camera Error', 'Could not open the camera.');
    }
  };
  const pickFromFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length) setPhoto(res.assets[0].uri);
    } catch (e: any) {
      console.warn('files failed:', e?.message ?? e);
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    }
  };

  const viewer = (
    <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
      <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewing(null)}>
        {!!viewing && <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" />}
      </TouchableOpacity>
    </Modal>
  );

  /* ---------------- new ticket form ---------------- */
  if (!ticketId) {
    const canSubmit = subject.trim().length > 2 && description.trim().length > 4 && !sending;
    const submit = async () => {
      setSending(true);
      const ok = await createTicket(category, subject.trim(), description.trim(), photo);
      setSending(false);
      if (ok) {
        Alert.alert('Ticket raised', 'The PG manager will reply here. You can track it from Help & Support.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Could not send', 'Please check your connection and try again.');
      }
    };
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {header('Raise Support Ticket')}
        <ScrollView contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.bodyBold, styles.label]}>Category</Text>
          <View style={styles.chipWrap}>
            {TICKET_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                activeOpacity={0.8}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[typography.caption, { color: category === c ? colors.white : colors.text }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Subject</Text>
          <TextInput
            style={styles.field}
            value={subject}
            onChangeText={setSubject}
            placeholder="Short summary"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />
          <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Description</Text>
          <TextInput
            style={[styles.field, { minHeight: 120, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell us what you need help with"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
          />

          <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Photo (optional)</Text>
          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)} hitSlop={6}>
                <Ionicons name="close" size={14} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={18} color={colors.primary} />
                <Text style={styles.photoBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickFromFiles} activeOpacity={0.8}>
                <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
                <Text style={styles.photoBtnText}>Files</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && { backgroundColor: colors.border }]}
            disabled={!canSubmit}
            onPress={submit}
            activeOpacity={0.85}
          >
            <Text style={[typography.button, { color: colors.white }]}>{sending ? 'Sending…' : 'Submit Ticket'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---------------- ticket conversation ---------------- */
  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header('Ticket')}
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
          Loading ticket…
        </Text>
      </SafeAreaView>
    );
  }

  const c = ticketColor(ticket.status);
  const closed = ticket.status === 'Closed';
  const resolved = ticket.status === 'Resolved';

  const send = () => {
    const text = input.trim();
    if (!text || closed) return;
    reply(ticket, text);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const confirmClose = () =>
    Alert.alert('Close ticket', 'Close this ticket? You can no longer reply to it.', [
      { text: 'No', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => close(ticket) },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {header(`Ticket #${ticket.id.slice(0, 6).toUpperCase()}`)}
      {viewer}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={ticket.replies}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.rowBetween}>
                <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{ticket.subject}</Text>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                  <Text style={[typography.caption, { color: c.text, fontWeight: '600' }]}>{ticket.status}</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {ticket.category} · {fmtWhen(ticket.createdAt)}
              </Text>
              <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>{ticket.description}</Text>
              {!!ticket.photo && (
                <TouchableOpacity activeOpacity={0.85} onPress={() => setViewing(ticket.photo!)}>
                  <Image source={{ uri: ticket.photo }} style={styles.ticketPhoto} resizeMode="cover" />
                </TouchableOpacity>
              )}
              {!!ticket.assignedTo && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  Assigned to: {ticket.assignedTo}
                </Text>
              )}
              {!!ticket.resolution && (
                <View style={styles.resolution}>
                  <Text style={[typography.caption, { color: colors.success, fontWeight: '700' }]}>Resolution</Text>
                  <Text style={[typography.body, { color: colors.text }]}>{ticket.resolution}</Text>
                </View>
              )}
              {resolved && (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => reopen(ticket)}>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>Not solved — Reopen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallBtn} onPress={confirmClose}>
                    <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '600' }]}>Close ticket</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>
              No replies yet. The manager will respond here.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.from === 'resident';
            return (
              <View style={[styles.bubble, mine ? styles.bubbleUser : styles.bubbleSupport]}>
                <Text style={[typography.body, { color: mine ? colors.white : colors.text }]}>{item.text}</Text>
                <Text style={[typography.caption, { color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted, marginTop: 2, fontSize: 10 }]}>
                  {mine ? 'You' : 'Manager'} · {fmtWhen(item.at)}
                </Text>
              </View>
            );
          }}
        />

        {closed ? (
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', padding: spacing.md }]}>
            This ticket is closed. Raise a new ticket if you need more help.
          </Text>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={resolved ? 'Reply to reopen this ticket…' : 'Type a message…'}
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={send} activeOpacity={0.8}>
              <Ionicons name="send" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  label: { color: colors.text, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.xs },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resolution: { backgroundColor: '#ECFDF5', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  smallBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.sm },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  bubbleSupport: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    color: colors.text,
    marginRight: spacing.sm,
  },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  photoBtnText: { color: colors.primary, fontWeight: '600', marginLeft: 6 },
  photoWrap: { width: 96, height: 96 },
  photo: { width: 96, height: 96, borderRadius: radius.md },
  photoRemove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  ticketPhoto: { width: '100%', height: 160, borderRadius: radius.md, marginTop: spacing.sm },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  sendButton: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});