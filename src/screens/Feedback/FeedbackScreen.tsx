import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useFeedback, FEEDBACK_CATEGORIES } from '../../hooks/useFeedback';

export const Stars = ({ value, onChange, size = 28 }: { value: number; onChange?: (n: number) => void; size?: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <TouchableOpacity key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4}>
        <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color="#F59E0B" style={{ marginRight: 2 }} />
      </TouchableOpacity>
    ))}
  </View>
);

export default function FeedbackScreen() {
  const navigation = useNavigation<any>();
  const { history, submit } = useFeedback();
  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[FEEDBACK_CATEGORIES.length - 1]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);

  const canSubmit = rating > 0 && !sending;

  const send = async () => {
    setSending(true);
    const ok = await submit(category, rating, text.trim(), anonymous);
    setSending(false);
    if (ok) {
      setRating(0);
      setText('');
      Alert.alert('Thank you', 'Your feedback was sent to the PG management.');
    } else {
      Alert.alert('Could not send', 'Please check your connection and try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Feedback</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[typography.bodyBold, styles.label]}>What is your feedback about?</Text>
        <View style={styles.chipWrap}>
          {FEEDBACK_CATEGORIES.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCategory(c)} activeOpacity={0.8} style={[styles.chip, category === c && styles.chipActive]}>
              <Text style={[typography.caption, { color: category === c ? colors.white : colors.text }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Your rating</Text>
        <Stars value={rating} onChange={setRating} />

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.lg }]}>Comments or suggestions (optional)</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Tell us what went well or what can improve"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={600}
        />

        <View style={styles.anonRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.text }]}>Send anonymously</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Your name is hidden from the manager's feedback list.</Text>
          </View>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.primary }} />
        </View>

        <TouchableOpacity style={[styles.sendBtn, !canSubmit && { backgroundColor: colors.border }]} disabled={!canSubmit} onPress={send} activeOpacity={0.85}>
          <Text style={[typography.button, { color: colors.white }]}>{sending ? 'Sending…' : 'Submit Feedback'}</Text>
        </TouchableOpacity>

        <Text style={[typography.bodyBold, styles.label, { marginTop: spacing.xl }]}>Previous Feedback</Text>
        {history.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>You haven't sent any feedback yet.</Text>
        ) : (
          history.map((f) => (
            <View key={f.id} style={styles.histCard}>
              <View style={styles.rowBetween}>
                <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{f.category}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <Stars value={f.rating} size={16} />
              {!!f.text && <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>{f.text}</Text>}
              {f.anonymous && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Sent anonymously</Text>}
              {!!f.adminNote && (
                <View style={styles.noteBox}>
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Manager's response</Text>
                  <Text style={[typography.body, { color: colors.text }]}>{f.adminNote}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  label: { color: colors.text, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 90, textAlignVertical: 'top' },
  anonRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  noteBox: { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
});