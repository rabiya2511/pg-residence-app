import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

type SendStatus = 'pending' | 'sending' | 'delivered';

export type WhatsAppRecipient = {
  id: string;
  name: string;
  message: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  recipients: WhatsAppRecipient[];
};

const WHATSAPP_GREEN = '#25D366';
const WHATSAPP_DARK = '#075E54';

export default function WhatsAppNotifyModal({ visible, onClose, title, recipients }: Props) {
  const [statuses, setStatuses] = useState<Record<string, SendStatus>>({});

  useEffect(() => {
    if (!visible) return;

    const initial: Record<string, SendStatus> = {};
    recipients.forEach((r) => (initial[r.id] = 'pending'));
    setStatuses(initial);

    recipients.forEach((r, index) => {
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [r.id]: 'sending' }));
      }, index * 500);
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [r.id]: 'delivered' }));
      }, index * 500 + 700);
    });
  }, [visible, recipients]);

  const allDelivered = recipients.length > 0 && recipients.every((r) => statuses[r.id] === 'delivered');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
            <Text style={[typography.bodyBold, { color: colors.white, marginLeft: spacing.sm, flex: 1 }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.testModeBanner}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <Text style={[typography.caption, { color: colors.warning, marginLeft: 4 }]}>
              Simulation only — no real messages are sent
            </Text>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ padding: spacing.md }}>
            {recipients.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg }]}>
                No recipients.
              </Text>
            ) : (
              recipients.map((r) => {
                const status = statuses[r.id] ?? 'pending';
                return (
                  <View key={r.id} style={styles.residentRow}>
                    <View style={styles.avatarWrap}>
                      <Ionicons name="person" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyBold, { color: colors.text }]}>{r.name}</Text>
                      <View style={styles.bubble}>
                        <Text style={[typography.caption, { color: colors.text }]}>{r.message}</Text>
                      </View>
                    </View>
                    <View style={styles.statusWrap}>
                      {status === 'pending' && (
                        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                      )}
                      {status === 'sending' && <ActivityIndicator size="small" color={WHATSAPP_GREEN} />}
                      {status === 'delivered' && (
                        <Ionicons name="checkmark-done" size={18} color={WHATSAPP_GREEN} />
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.doneButton, !allDelivered && recipients.length > 0 && styles.doneButtonDisabled]}
              activeOpacity={0.85}
              onPress={onClose}
              disabled={!allDelivered && recipients.length > 0}
            >
              <Text style={[typography.button, { color: colors.white }]}>
                {recipients.length === 0 ? 'Close' : allDelivered ? 'Done' : 'Sending...'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHATSAPP_DARK,
    padding: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  testModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  residentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  bubble: {
    backgroundColor: '#DCF8C6',
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.sm,
    marginTop: 4,
  },
  statusWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButton: {
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
});