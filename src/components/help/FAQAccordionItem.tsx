import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { FAQItem } from '../../constants/mockData';

type Props = {
  faq: FAQItem;
};

export default function FAQAccordionItem({ faq }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => setExpanded((prev) => !prev)}
    >
      <View style={styles.row}>
        <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>
          {faq.question}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>
      {expanded && (
        <Text style={[typography.body, styles.answer]}>{faq.answer}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  answer: {
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});