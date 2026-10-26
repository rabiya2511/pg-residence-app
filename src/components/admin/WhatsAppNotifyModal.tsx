import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { openWhatsApp } from '../../utils/whatsapp';
import ResidentAvatar from '../common/ResidentAvatar';

export type WhatsAppRecipient = {
  id: string;
  name: string;
  message: string;
  /** Resident's phone number. Without it the message cannot be opened in WhatsApp. */
  phone?: string | null;
  /** Resident's profile photo, shown next to the name. */
  profileImageUri?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  recipients: WhatsAppRecipient[];
};

// Real hand-off to the WhatsApp installed on this phone: tapping "Send" opens that resident's
// chat with the message already typed in. The admin presses WhatsApp's own send button.
export default function WhatsAppNotifyModal({ visible, onClose, title, recipients }: Props) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) setOpened({});
  }, [visible, recipients]);

  const send = async (r: WhatsAppRecipient) => {
    const ok = await openWhatsApp(r.phone ?? '', r.message);
    if (ok) setOpened((prev) => ({ ...prev, [r.id]: true }));
  };

  const doneCount = recipients.filter((r) => opened[r.id]).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons name="logo-whatsapp" size={20} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, flex: 1, marginLeft: spacing.sm }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.info}>
            <Ionicons name="information-circle-outline" size={15} color="#075E54" />
            <Text style={styles.infoText}>
              Tap Send to open WhatsApp with the message ready, then press send there.
              {recipients.length > 1 ? ` (${doneCount}/${recipients.length} opened)` : ''}
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: spacing.md }}>
            {recipients.length === 0 && (
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>No one to notify.</Text>
            )}
            {recipients.map((r) => (
              <View key={r.id} style={styles.item}>
                <View style={styles.itemTop}>
                  <ResidentAvatar uri={r.profileImageUri} name={r.name} size={32} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[typography.caption, { color: r.phone ? colors.textMuted : colors.error }]}>
                      {r.phone || 'No phone number saved'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.sendBtn, !r.phone && { opacity: 0.45 }, opened[r.id] && styles.sendBtnDone]}
                    disabled={!r.phone}
                    activeOpacity={0.85}
                    onPress={() => send(r)}
                  >
                    <Ionicons name={opened[r.id] ? 'checkmark' : 'logo-whatsapp'} size={15} color={colors.white} />
                    <Text style={styles.sendText}>{opened[r.id] ? 'Opened' : 'Send'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.bubble}>
                  <Text style={{ color: '#111', fontSize: 13 }}>{r.message}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.done} activeOpacity={0.85} onPress={onClose}>
            <Text style={[typography.button, { color: colors.white }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', paddingBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#075E54', padding: spacing.md },
  info: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F8EE', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  infoText: { flex: 1, fontSize: 12, color: '#075E54' },
  item: { marginBottom: spacing.md },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25D366', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7, gap: 5 },
  sendBtnDone: { backgroundColor: colors.textMuted },
  sendText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  bubble: { backgroundColor: '#DCF8C6', borderRadius: 10, padding: spacing.sm, marginTop: spacing.xs, marginLeft: 40 },
  done: { backgroundColor: '#25D366', borderRadius: radius.md, marginHorizontal: spacing.md, paddingVertical: spacing.md, alignItems: 'center' },
});