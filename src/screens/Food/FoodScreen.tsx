import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { weekDays } from '../../constants/mockData';
import { useFood, FoodFeedback } from '../../context/FoodContext';
import MealCard from '../../components/food/MealCard';

const KINDS: FoodFeedback['kind'][] = ['Suggestion', 'Complaint', 'Quality'];

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const { getRating, rateMeal, menu, timings, note, feedback, submitFeedback } = useFood();

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [selectedDay, setSelectedDay] = useState(
    (weekDays as string[]).find((d) => d === todayName) ?? weekDays[0]
  );
  const [kind, setKind] = useState<FoodFeedback['kind']>('Suggestion');
  const [text, setText] = useState('');

  const mealsForDay = menu.filter((entry) => entry.day === selectedDay);

  const send = () => {
    if (!text.trim()) return;
    submitFeedback(kind, text.trim());
    setText('');
    Alert.alert('Thank you', 'Your feedback was sent to the PG management.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Mess Menu</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabsRow} style={{ flexGrow: 0 }}>
        {weekDays.map((day: string) => {
          const isSelected = day === selectedDay;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, isSelected && styles.dayTabSelected]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.8}
            >
              <Text style={[typography.caption, { color: isSelected ? colors.white : colors.text, fontWeight: '600' }]}>
                {day.slice(0, 3)}
                {day === todayName ? ' •' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!!note && (
          <View style={styles.noteBox}>
            <Ionicons name="megaphone-outline" size={18} color={colors.warning} />
            <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>{note}</Text>
          </View>
        )}

        <View style={styles.timingsCard}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>SERVING TIMINGS</Text>
          {['Breakfast', 'Lunch', 'Dinner'].map((m) => (
            <View key={m} style={styles.timingRow}>
              <Text style={[typography.body, { color: colors.text }]}>{m}</Text>
              <Text style={[typography.body, { color: colors.textMuted }]}>{timings[m]}</Text>
            </View>
          ))}
        </View>

        {mealsForDay.map((meal) => (
          <MealCard
            key={meal.mealType}
            mealType={meal.mealType as any}
            items={meal.items}
            rating={getRating(meal.day, meal.mealType)}
            onRate={(rating) => rateMeal(meal.day, meal.mealType, rating)}
          />
        ))}

        <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Food Feedback
        </Text>
        <View style={styles.chipWrap}>
          {KINDS.map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => setKind(k)}
              activeOpacity={0.8}
              style={[styles.chip, kind === k && styles.chipActive]}
            >
              <Text style={[typography.caption, { color: kind === k ? colors.white : colors.text }]}>
                {k === 'Quality' ? 'Food Quality' : k}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Menu suggestion, food complaint or quality feedback"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && { backgroundColor: colors.border }]}
          onPress={send}
          disabled={!text.trim()}
          activeOpacity={0.85}
        >
          <Text style={[typography.button, { color: colors.white }]}>Send Feedback</Text>
        </TouchableOpacity>

        {feedback.length > 0 && (
          <>
            <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Previous Feedback
            </Text>
            {feedback.map((f) => (
              <View key={f.id} style={styles.feedbackCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                    {f.kind === 'Quality' ? 'Food Quality' : f.kind}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>{f.text}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
  dayTabsRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  dayTabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  timingsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  timingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});