import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { MealType } from '../../constants/mockData';

const mealIcons: Record<MealType, string> = {
  Breakfast: 'sunny-outline',
  Lunch: 'restaurant-outline',
  Dinner: 'moon-outline',
};

type Props = {
  mealType: MealType;
  items: string;
  rating: number;
  onRate: (rating: number) => void;
};

export default function MealCard({ mealType, items, rating, onRate }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={mealIcons[mealType] as any} size={18} color={colors.primary} />
        </View>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{mealType}</Text>
      </View>

      <Text style={[typography.body, styles.items]}>{items}</Text>

      <View style={styles.ratingRow}>
        <Text style={[typography.caption, { color: colors.textMuted, marginRight: spacing.sm }]}>
          {rating > 0 ? 'Your rating:' : 'Rate this meal:'}
        </Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => onRate(star)} hitSlop={6}>
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={18}
                color={star <= rating ? colors.secondary : colors.textMuted}
                style={{ marginRight: 2 }}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  items: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
  },
});