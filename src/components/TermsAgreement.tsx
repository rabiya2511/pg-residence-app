import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';
import { TERMS_AND_CONDITIONS_TEXT } from '../constants/termsAndConditions';

type TermsAgreementProps = {
  agreed: boolean;
  onChange: (agreed: boolean) => void;
};

export default function TermsAgreement({ agreed, onChange }: TermsAgreementProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.checkbox, agreed && styles.checkboxChecked]}
          activeOpacity={0.7}
          onPress={() => onChange(!agreed)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {agreed && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </TouchableOpacity>

        <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
          I agree to the{' '}
          <Text style={styles.link} onPress={() => setModalVisible(true)}>
            Terms and Conditions
          </Text>
        </Text>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={[typography.heading3, { color: colors.text }]}>Terms and Conditions</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator>
              <Text style={[typography.body, { color: colors.text, lineHeight: 22 }]}>
                {TERMS_AND_CONDITIONS_TEXT}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.acceptButton}
              activeOpacity={0.85}
              onPress={() => {
                onChange(true);
                setModalVisible(false);
              }}
            >
              <Text style={[typography.button, { color: colors.white }]}>I Agree</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeTextButton} onPress={() => setModalVisible(false)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  termsScroll: {
    maxHeight: 320,
    marginBottom: spacing.md,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeTextButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});