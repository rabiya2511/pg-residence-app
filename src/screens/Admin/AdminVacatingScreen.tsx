import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident, Room, properties } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parses "25 Sep 2026" (dd MMM yyyy) into a comparable timestamp
function parseVacatingDate(str: string): number {
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return Number.MAX_SAFE_INTEGER;
  return new Date(Number(m[3]), monthIdx, Number(m[1])).getTime();
}

function getPropertyName(propertyId: string): string {
  return properties.find((p) => p.id === propertyId)?.name ?? 'Unknown Property';
}

function VacatingCard({
  resident,
  isEarliest,
  rooms,
}: {
  resident: AdminResident;
  isEarliest: boolean;
  rooms: Room[];
}) {
  const roomNumber = rooms.find((r) => r.id === resident.roomId)?.roomNumber ?? 'Unassigned';
  const propertyName = getPropertyName(resident.propertyId);

  return (
    <View style={[styles.card, isEarliest && styles.cardHighlighted]}>
      <View style={[styles.avatarWrap, isEarliest && styles.avatarHighlighted]}>
        <Ionicons name="exit-outline" size={20} color={isEarliest ? colors.white : colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.rowTop}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
          {isEarliest && (
            <View style={styles.soonestBadge}>
              <Text style={[typography.caption, { color: colors.white }]}>Vacating Soonest</Text>
            </View>
          )}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          Room {roomNumber} · {propertyName}
        </Text>
        <Text style={[typography.bodyBold, { color: isEarliest ? colors.error : colors.text, marginTop: spacing.xs }]}>
          Vacating on {resident.vacatingDate}
        </Text>
      </View>
    </View>
  );
}

export default function AdminVacatingScreen() {
  const { residents, rooms } = useAdmin();

  const vacatingResidents = residents
    .filter((r) => !!r.vacatingDate)
    .sort((a, b) => parseVacatingDate(a.vacatingDate!) - parseVacatingDate(b.vacatingDate!));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[typography.heading2, { color: colors.text }]}>Vacating</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{vacatingResidents.length} notice(s)</Text>
        </View>
      </View>

      <FlatList
        data={vacatingResidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No vacate notices submitted yet.
          </Text>
        }
        renderItem={({ item, index }) => <VacatingCard resident={item} isEarliest={index === 0} rooms={rooms} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { padding: spacing.md },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHighlighted: {
    borderColor: colors.error,
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarHighlighted: {
    backgroundColor: colors.error,
  },
  content: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  soonestBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
});