import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { weekDays, weeklyMenu, MealType } from '../../constants/mockData';
import { useFood } from '../../context/FoodContext';
import MealCard from '../../components/food/MealCard';

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const { getRating, rateMeal } = useFood();
  const [selectedDay, setSelectedDay] = useState(weekDays[0]);

  const mealsForDay = weeklyMenu.filter((entry) => entry.day === selectedDay);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Mess Menu</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabsRow}
      >
        {weekDays.map((day) => {
          const isSelected = day === selectedDay;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, isSelected && styles.dayTabSelected]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.caption,
                  { color: isSelected ? colors.white : colors.text, fontWeight: '600' },
                ]}
              >
                {day.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {mealsForDay.map((meal) => (
          <MealCard
            key={meal.mealType}
            mealType={meal.mealType}
            items={meal.items}
            rating={getRating(meal.day, meal.mealType)}
            onRate={(rating) => rateMeal(meal.day, meal.mealType, rating)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  dayTabsRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  dayTabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
}); 