import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdminFeedback, FeedbackItem, FEEDBACK_CATEGORIES } from '../../hooks/useFeedback';

const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Ionicons key={n} name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color="#F59E0B" />
    ))}
  </View>
);

function Card({ f, onReview }: { f: FeedbackItem; onReview: (id: string, note: string) => void }) {
  const [note, setNote] = useState(f.adminNote ?? '');
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{f.category}</Text>
        {!f.reviewed && (
          <View style={styles.newBadge}>
            <Text style={{ color: colors.error, fontSize: 11, fontWeight: '700' }}>NEW</Text>
          </View>
        )}
      </View>
      <Stars value={f.rating} />
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
        {f.anonymous ? 'Anonymous resident' : f.residentName} ·{' '}
        {new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
      {!!f.text && <Text style={[typography.body, { color: colors.text, marginTop: spacing.xs }]}>{f.text}</Text>}
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Response to the resident (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <TouchableOpacity style={styles.reviewBtn} onPress={() => onReview(f.id, note)} activeOpacity={0.85}>
        <Text style={[typography.caption, { color: colors.white, fontWeight: '600' }]}>
          {f.reviewed ? 'Update response' : 'Mark as reviewed'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminFeedbackScreen() {
  const navigation = useNavigation<any>();
  const { items, newCount, review } = useAdminFeedback();
  const [filter, setFilter] = useState<'New' | 'Reviewed' | 'All'>('New');

  const averages = useMemo(
    () =>
      FEEDBACK_CATEGORIES.map((c) => {
        const list = items.filter((f) => f.category === c);
        return { c, count: list.length, avg: list.length ? list.reduce((s, f) => s + f.rating, 0) / list.length : 0 };
      }).filter((a) => a.count > 0),
    [items]
  );
  const shown = items.filter((f) => (filter === 'All' ? true : filter === 'New' ? !f.reviewed : !!f.reviewed));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Resident Feedback</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {averages.length > 0 && (
              <View style={[styles.card, { marginBottom: spacing.md }]}>
                <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.xs }]}>Average ratings</Text>
                {averages.map((a) => (
                  <View key={a.c} style={[styles.rowBetween, { paddingVertical: 3 }]}>
                    <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{a.c}</Text>
                    <Stars value={a.avg} />
                    <Text style={[typography.caption, { color: colors.textMuted, width: 60, textAlign: 'right' }]}>
                      {a.avg.toFixed(1)} ({a.count})
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.sm }}>
              {(['New', 'Reviewed', 'All'] as const).map((f) => (
                <TouchableOpacity key={f} onPress={() => setFilter(f)} activeOpacity={0.8} style={[styles.chip, filter === f && styles.chipActive]}>
                  <Text style={[typography.caption, { color: filter === f ? colors.white : colors.text }]}>
                    {f}
                    {f === 'New' && newCount ? ` (${newCount})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <Ionicons name="chatbox-ellipses-outline" size={48} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>No feedback here</Text>
          </View>
        }
        renderItem={({ item }) => <Card f={item} onReview={review} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  newBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: 14, color: colors.text, marginTop: spacing.sm, minHeight: 44 },
  reviewBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md, alignSelf: 'flex-start', marginTop: spacing.sm },
});