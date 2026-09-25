import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

type Props = {
  visible: boolean;
  loading: boolean;
  onSelectAccount: () => void;
  onClose: () => void;
};

export default function GoogleAccountPickerModal({ visible, loading, onSelectAccount, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons name="logo-google" size={22} color={colors.text} />
            <Text style={[typography.bodyBold, { color: colors.text, marginLeft: spacing.sm }]}>
              Choose an account
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[typography.body, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                Signing in…
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.accountRow} activeOpacity={0.7} onPress={onSelectAccount}>
              <View style={styles.avatarWrap}>
                <Ionicons name="person" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[typography.bodyBold, { color: colors.text }]}>Rabiya</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  rabiya@example.com
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {!loading && (
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg ?? radius.md,
    borderTopRightRadius: radius.lg ?? radius.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});