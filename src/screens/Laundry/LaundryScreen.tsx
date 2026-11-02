import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMyLaundry, LaundryRequest, LaundryStatus } from '../../hooks/useLaundry';

export const STATUS_STYLE: Record<LaundryStatus, { bg: string; fg: string }> = {
  Requested: { bg: colors.amberBg, fg: '#92400E' },
  'Pickup Scheduled': { bg: colors.primaryLight, fg: colors.primary },
  Collected: { bg: colors.primaryLight, fg: colors.primary },
  Processing: { bg: colors.primaryLight, fg: colors.primary },
  Ready: { bg: colors.successBg, fg: colors.success },
  Delivered: { bg: colors.successBg, fg: colors.success },
  Cancelled: { bg: colors.border, fg: colors.textMuted },
};

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const isHistory = (s: LaundryStatus) => s === 'Delivered' || s === 'Cancelled';

function LaundryCard({ item, onCancel }: { item: LaundryRequest; onCancel: () => void }) {
  const s = STATUS_STYLE[item.status];
  const canCancel = item.status === 'Requested' || item.status === 'Pickup Scheduled';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{item.serviceType}</Text>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={[typography.caption, { color: s.fg, fontWeight: '700' }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
        {item.numClothes} clothes · Room {item.room}
      </Text>
      <View style={styles.line}>
        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
        <Text style={[typography.caption, { color: colors.text, marginLeft: 4 }]}>
          Pickup {item.pickupDate}, {item.pickupSlot}
        </Text>
      </View>
      {!!item.expectedDelivery && (
        <View style={styles.line}>
          <Ionicons name="bag-check-outline" size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.text, marginLeft: 4 }]}>
            Expected delivery {item.expectedDelivery}
          </Text>
        </View>
      )}
      {item.charges !== null && (
        <View style={styles.line}>
          <Ionicons name="cash-outline" size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.text, marginLeft: 4 }]}>
            Charges {formatINR(item.charges)} ·{' '}
            <Text style={{ color: item.paymentStatus === 'Paid' ? colors.success : colors.error, fontWeight: '700' }}>
              {item.paymentStatus}
            </Text>
          </Text>
        </View>
      )}
      {!!item.notes && (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Note: {item.notes}</Text>
      )}
      {!!item.adminRemarks && (
        <View style={styles.remarks}>
          <Text style={[typography.caption, { color: colors.text }]}>Admin: {item.adminRemarks}</Text>
        </View>
      )}
      {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.photo} />}
      {canCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Cancel Request</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function LaundryScreen() {
  const navigation = useNavigation<any>();
  const { requests, loaded, cancelRequest } = useMyLaundry();
  const [tab, setTab] = useState<'Active' | 'History'>('Active');

  const active = useMemo(() => requests.filter((r) => !isHistory(r.status)), [requests]);
  const history = useMemo(() => requests.filter((r) => isHistory(r.status)), [requests]);
  const shown = tab === 'Active' ? active : history;

  const confirmCancel = (r: LaundryRequest) => {
    Alert.alert('Cancel Request', `Cancel your ${r.serviceType} request for ${r.pickupDate}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          const result = await cancelRequest(r.id);
          if (!result.ok) Alert.alert('Could Not Cancel', result.message ?? 'Please try again.');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Laundry</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabRow}>
        {(['Active', 'History'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[typography.caption, { color: tab === t ? colors.white : colors.text, fontWeight: '600' }]}>
              {t} ({t === 'Active' ? active.length : history.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shirt-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            {requests.length === 0
              ? 'No laundry requests yet.\nTap + to book a pickup.'
              : tab === 'Active'
              ? 'No active laundry requests.'
              : 'No past laundry requests.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <LaundryCard item={item} onCancel={() => confirmCancel(item)} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('NewLaundry')}>
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
  tabRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  tab: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  line: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  remarks: { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  photo: { width: 72, height: 72, borderRadius: radius.sm, marginTop: spacing.sm },
  cancelBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
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