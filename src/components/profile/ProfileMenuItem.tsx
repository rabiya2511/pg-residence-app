import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';

type Props = {
  label: string;
  icon: string;
  isLast?: boolean;
  isDestructive?: boolean;
  onPress: () => void;
};

export default function ProfileMenuItem({ label, icon, isLast, isDestructive, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View style={styles.left}>
        <Ionicons
          name={icon as any}
          size={20}
          color={isDestructive ? colors.error : colors.textMuted}
        />
        <Text
          style={[
            typography.body,
            { marginLeft: spacing.sm, color: isDestructive ? colors.error : colors.text },
          ]}
        >
          {label}
        </Text>
      </View>
      {!isDestructive && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});