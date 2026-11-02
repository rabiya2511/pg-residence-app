import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useComplaints, ResidentComplaint } from '../../context/ComplaintsContext';

const statusStyle: Record<string, { bg: string; text: string }> = {
  Open: { bg: '#FEE2E2', text: colors.error },
  'In Progress': { bg: '#FEF3C7', text: colors.warning },
  Resolved: { bg: '#D1FAE5', text: colors.success },
};

// Submitted -> In Progress -> Resolved, with the date each step was reached.
function Timeline({ c }: { c: ResidentComplaint }) {
  const steps = [
    { label: 'Submitted', date: c.date, done: true },
    { label: 'In Progress', date: c.inProgressOn, done: c.status === 'In Progress' || c.status === 'Resolved' },
    { label: 'Resolved', date: c.resolvedOn, done: c.status === 'Resolved' },
  ];
  return (
    <View style={styles.timeline}>
      {steps.map((s, i) => (
        <View key={s.label} style={styles.step}>
          <View style={styles.stepLine}>
            <View style={[styles.dot, s.done && styles.dotOn]} />
            {i < steps.length - 1 && <View style={[styles.line, steps[i + 1].done && styles.lineOn]} />}
          </View>
          <Text style={[styles.stepLabel, s.done && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
            {s.label}
          </Text>
          <Text style={styles.stepDate} numberOfLines={1}>{s.done ? s.date || '' : ''}</Text>
        </View>
      ))}
    </View>
  );
}

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} disabled={!onPick} onPress={() => onPick?.(n)} hitSlop={4}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={onPick ? 28 : 18}
            color={n <= value ? '#F59E0B' : colors.textMuted}
            style={{ marginRight: 4 }}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ComplaintItem({
  c,
  onPhoto,
  onReopen,
  onRate,
}: {
  c: ResidentComplaint;
  onPhoto: (uri: string) => void;
  onReopen: () => void;
  onRate: (n: number) => void;
}) {
  const st = statusStyle[c.status] ?? statusStyle.Open;
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{c.category}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            #{c.id.slice(-6).toUpperCase()} · {c.date}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[typography.caption, { color: st.text, fontWeight: '700' }]}>{c.status}</Text>
        </View>
      </View>

      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>{c.description}</Text>

      {c.photos.length > 0 && (
        <View style={styles.photoRow}>
          {c.photos.map((u) => (
            <TouchableOpacity key={u} onPress={() => onPhoto(u)} activeOpacity={0.85}>
              <Image source={{ uri: u }} style={styles.photo} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Timeline c={c} />

      {!!c.reopenedOn && (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Reopened on {c.reopenedOn}</Text>
      )}

      {!!c.adminComment && (
        <View style={styles.commentBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
              PG team{c.adminCommentOn ? ` · ${c.adminCommentOn}` : ''}
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.text, marginTop: 2 }]}>{c.adminComment}</Text>
        </View>
      )}

      {c.status === 'Resolved' && (
        <View style={styles.resolvedBox}>
          {c.rating ? (
            <View style={styles.rowBetween}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Your rating</Text>
              <Stars value={c.rating} />
            </View>
          ) : (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 6 }]}>
                How was the resolution? Tap to rate.
              </Text>
              <Stars value={0} onPick={onRate} />
            </View>
          )}
          <TouchableOpacity style={styles.reopenBtn} onPress={onReopen} activeOpacity={0.85}>
            <Ionicons name="refresh" size={16} color={colors.error} />
            <Text style={styles.reopenText}>Not fixed? Reopen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ComplaintsListScreen() {
  const navigation = useNavigation<any>();
  const { complaints, reopenComplaint, rateComplaint } = useComplaints();
  const [viewing, setViewing] = useState<string | null>(null);

  const confirmReopen = (c: ResidentComplaint) =>
    Alert.alert('Reopen Complaint', 'Send this complaint back to the PG team as unresolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: async () => {
          const ok = await reopenComplaint(c.id);
          if (!ok) Alert.alert('Could Not Reopen', 'Please check your connection and try again.');
        },
      },
    ]);

  const rate = async (c: ResidentComplaint, n: number) => {
    const ok = await rateComplaint(c.id, n);
    if (!ok) Alert.alert('Could Not Save', 'Please check your connection and try again.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Complaints</Text>
        <View style={{ width: 22 }} />
      </View>

      {complaints.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No complaints raised yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ComplaintItem
              c={item}
              onPhoto={setViewing}
              onReopen={() => confirmReopen(item)}
              onRate={(n) => rate(item, n)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('NewComplaint')}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewing(null)}>
          {!!viewing && <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
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
  listContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  photoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  photo: { width: 64, height: 64, borderRadius: radius.sm },
  timeline: { flexDirection: 'row', marginTop: spacing.md },
  step: { flex: 1 },
  stepLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.success },
  line: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 2 },
  lineOn: { backgroundColor: colors.success },
  stepLabel: { fontSize: 11, color: colors.textMuted },
  stepDate: { fontSize: 10, color: colors.textMuted },
  commentBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  resolvedBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  reopenText: { color: colors.error, fontWeight: '700', marginLeft: 6, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
});