import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import type { Property } from '../../constants/mockData';

type Props = {
  visible: boolean;
  onClose: () => void;
  properties: Property[];
  activeId?: string | null;
  onPick: (propertyId: string) => void;
  /** When given, a "Manage All Properties" button is shown at the bottom of the sheet. */
  onManage?: () => void;
};

// The "Switch Branch" bottom sheet: pick which property the admin is working in.
export default function SwitchBranchSheet({ visible, onClose, properties, activeId, onPick, onManage }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.heading3, { color: colors.text }]}>Switch Branch</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                Select active property for Admin Portal
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 320, marginTop: spacing.md }} showsVerticalScrollIndicator={false}>
            {properties.length === 0 && (
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', padding: spacing.md }]}>
                No properties yet.
              </Text>
            )}
            {properties.map((p) => {
              const isActive = p.id === activeId;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.row, isActive && styles.rowActive]}
                  activeOpacity={0.85}
                  onPress={() => onPick(p.id)}
                >
                  <Image
                    source={p.logoUri ? { uri: p.logoUri } : require('../../../assets/pg-logo.png')}
                    style={styles.logo}
                  />
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {[p.address, p.floors ? `${p.floors} Floor${p.floors !== 1 ? 's' : ''}` : null].filter(Boolean).join(' • ')}
                    </Text>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]} numberOfLines={1}>
                      Manager: {p.branchManager ?? 'Unassigned'}{p.contactPhone ? ` (${p.contactPhone})` : ''}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>ACTIVE</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {onManage && (
            <TouchableOpacity style={styles.manageButton} activeOpacity={0.85} onPress={onManage}>
              <Ionicons name="settings" size={18} color={colors.white} />
              <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Manage All Properties</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `${colors.primary}15` },
  logo: { width: 48, height: 48, borderRadius: radius.sm },
  badge: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
});