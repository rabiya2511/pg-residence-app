import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getFirestore, collection, doc, onSnapshot, query, where, updateDoc } from '@react-native-firebase/firestore';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

type Filter = 'Pending' | 'Approved' | 'Inside' | 'History';
const FILTERS: Filter[] = ['Pending', 'Approved', 'Inside', 'History'];

const inFilter = (f: Filter, status: string) =>
  f === 'Pending'
    ? status === 'Pending'
    : f === 'Approved'
    ? status === 'Approved'
    : f === 'Inside'
    ? status === 'Checked In'
    : ['Rejected', 'Cancelled', 'Checked Out'].includes(status);

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export default function AdminVisitorsScreen() {
  const navigation = useNavigation<any>();
  const { activePropertyId, activeProperty } = useAdmin();
  const db = getFirestore();

  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('Pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [reason, setReason] = useState('');

  // Visitors of the property the admin is working in, live.
  useEffect(() => {
    setLoaded(false);
    setRows([]);
    if (!activePropertyId) {
      setLoaded(true);
      return;
    }
    return onSnapshot(
      query(collection(db, 'visitors'), where('propertyId', '==', activePropertyId)),
      (snap: any) => {
        setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id })));
        setLoaded(true);
      },
      (e: any) => {
        console.warn('admin visitors listener:', e?.code);
        setLoaded(true);
      }
    );
  }, [activePropertyId]);

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    FILTERS.forEach((f) => (c[f] = rows.filter((v) => inFilter(f, v.status)).length));
    return c;
  }, [rows]);

  const shown = useMemo(
    () =>
      rows
        .filter((v) => inFilter(filter, v.status))
        .sort((a, b) => (a.expectedDateTs ?? 0) - (b.expectedDateTs ?? 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [rows, filter]
  );

  // Only acts when the request is still in the state the button was shown for
  // (the resident may have cancelled it a second ago).
  const update = async (id: string, expected: string, patch: Record<string, any>) => {
    const current = rows.find((v) => v.id === id);
    if (!current || current.status !== expected) {
      Alert.alert('Request Changed', 'This request was just updated. The list has been refreshed.');
      return;
    }
    setBusyId(id);
    try {
      await Promise.race([
        updateDoc(doc(db, 'visitors', id), patch),
        new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 10000)),
      ]);
    } catch (e: any) {
      console.warn('visitor update failed:', e?.code ?? e?.message);
      Alert.alert(
        'Could Not Update',
        e?.code === 'firestore/permission-denied'
          ? 'Not allowed. Publish the latest Firestore rules and try again.'
          : 'Check your connection and try again.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const approve = (v: any) => update(v.id, 'Pending', { status: 'Approved', decidedAt: Date.now() });
  const checkIn = (v: any) =>
    update(v.id, 'Approved', { status: 'Checked In', checkInTime: timeNow(), checkInAt: Date.now() });
  const checkOut = (v: any) =>
    update(v.id, 'Checked In', { status: 'Checked Out', checkOutTime: timeNow(), checkOutAt: Date.now() });

  const submitReject = async () => {
    if (!rejectFor) return;
    const v = rejectFor;
    setRejectFor(null);
    await update(v.id, 'Pending', {
      status: 'Rejected',
      rejectReason: reason.trim() || null,
      decidedAt: Date.now(),
    });
    setReason('');
  };

  const renderItem = ({ item: v }: { item: any }) => {
    const busy = busyId === v.id;
    const when = [v.expectedDate, v.expectedArrival ? (v.expectedDeparture ? `${v.expectedArrival} – ${v.expectedDeparture}` : v.expectedArrival) : '']
      .filter(Boolean)
      .join(' · ');
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {v.visitorName}
          </Text>
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>{v.status}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          For {v.residentName || 'resident'}{v.room ? ` · Room ${v.room}` : ''}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          {[v.relationship, v.purpose].filter(Boolean).join(' · ')}
          {(v.numVisitors ?? 1) > 1 ? ` · ${v.numVisitors} visitors` : ''}
        </Text>
        {!!when && <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>{when}</Text>}
        {!!v.visitorPhone && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Phone: {v.visitorPhone}</Text>
        )}
        {!!v.instructions && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Note: {v.instructions}</Text>
        )}
        {v.status === 'Rejected' && !!v.rejectReason && (
          <Text style={[typography.caption, { color: colors.error, marginTop: 4 }]}>Reason: {v.rejectReason}</Text>
        )}
        {(v.checkInTime || v.checkOutTime) && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
            {v.checkInTime ? `Entered ${v.checkInTime}` : ''}
            {v.checkOutTime ? ` · Left ${v.checkOutTime}` : ''}
          </Text>
        )}

        {busy ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
        ) : (
          <View style={styles.actions}>
            {v.status === 'Pending' && (
              <>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => approve(v)}>
                  <Text style={[typography.caption, styles.btnText]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.error }]}
                  onPress={() => {
                    setReason('');
                    setRejectFor(v);
                  }}
                >
                  <Text style={[typography.caption, styles.btnText]}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {v.status === 'Approved' && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => checkIn(v)}>
                <Text style={[typography.caption, styles.btnText]}>Mark Entered</Text>
              </TouchableOpacity>
            )}
            {v.status === 'Checked In' && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => checkOut(v)}>
                <Text style={[typography.caption, styles.btnText]}>Mark Left</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Visitor Requests</Text>
          {!!activeProperty?.name && (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{activeProperty.name}</Text>
          )}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[typography.caption, { color: filter === f ? colors.white : colors.text, fontWeight: '600' }]}>
                {f} ({counts[f]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No {filter.toLowerCase()} visitor requests.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={!!rejectFor} transparent animationType="fade" onRequestClose={() => setRejectFor(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={[typography.heading3, { color: colors.text }]}>Reject visit</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm }]}>
              {rejectFor?.visitorName} for {rejectFor?.residentName}. The resident will see your reason.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setRejectFor(null)}>
                <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.error, flex: 1 }]} onPress={submitReject}>
                <Text style={[typography.caption, styles.btnText]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.white, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    color: colors.text,
  },
  sheetButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});