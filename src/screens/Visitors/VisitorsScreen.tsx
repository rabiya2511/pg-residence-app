import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import VisitorCard from '../../components/visitors/VisitorCard';
import { useVisitors, VisitorRequest } from '../../context/VisitorsContext';

type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Inside' | 'Left';
const FILTERS: Filter[] = ['All', 'Pending', 'Approved', 'Rejected', 'Inside', 'Left'];

const matches = (f: Filter, v: VisitorRequest) => {
  if (f === 'All') return true;
  if (f === 'Inside') return v.status === 'Checked In';
  if (f === 'Left') return v.status === 'Checked Out';
  return v.status === f;
};

export default function VisitorsScreen() {
  const navigation = useNavigation<any>();
  const { visitorLogs, cancelVisitor } = useVisitors();
  const [filter, setFilter] = useState<Filter>('All');

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    FILTERS.forEach((f) => (c[f] = visitorLogs.filter((v) => matches(f, v)).length));
    return c;
  }, [visitorLogs]);

  const shown = useMemo(() => visitorLogs.filter((v) => matches(filter, v)), [visitorLogs, filter]);

  const confirmCancel = (v: VisitorRequest) => {
    Alert.alert('Cancel Request', `Cancel the visit request for ${v.visitorName}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          const result = await cancelVisitor(v.id);
          if (!result.ok) Alert.alert('Could Not Cancel', result.message ?? 'Please try again.');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Visitors</Text>
        <View style={{ width: 22 }} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '600' }]}>
                  {f} ({counts[f]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {shown.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            {visitorLogs.length === 0
              ? 'No visitor requests yet.\nTap + to request a visit.'
              : `No ${filter.toLowerCase()} visitor requests.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <VisitorCard visitor={item} onCancel={() => confirmCancel(item)} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('NewVisitor')}>
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>
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
  chipRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  listContent: { padding: spacing.md, paddingBottom: 96 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
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
});