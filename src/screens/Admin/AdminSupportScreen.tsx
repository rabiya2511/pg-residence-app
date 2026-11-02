import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdminSupport } from '../../hooks/useAdminSupport';
import { SupportTicket, TICKET_STATUSES, ticketColor, fmtWhen } from '../../hooks/useSupportTickets';

const FILTERS = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'All'] as const;

function TicketCard({ t, api }: { t: SupportTicket; api: ReturnType<typeof useAdminSupport> }) {
  const [open, setOpen] = useState(false);
  const [assigned, setAssigned] = useState(t.assignedTo ?? '');
  const [resolution, setResolution] = useState(t.resolution ?? '');
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState(false);
  const c = ticketColor(t.status);

  useEffect(() => {
    setAssigned(t.assignedTo ?? '');
    setResolution(t.resolution ?? '');
  }, [t.assignedTo, t.resolution]);

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen((o) => !o)}>
        <View style={styles.rowBetween}>
          <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>{t.subject}</Text>
          <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[typography.caption, { color: c.text, fontWeight: '600' }]}>{t.status}</Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          #{t.id.slice(0, 6).toUpperCase()} · {t.residentName} · Room {t.room ?? '-'} · {t.category}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Updated {fmtWhen(t.updatedAt)}</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[typography.body, { color: colors.text }]}>{t.description}</Text>

          <Text style={[typography.caption, styles.sub]}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {TICKET_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => api.setStatus(t, s)}
                activeOpacity={0.8}
                style={[styles.chip, t.status === s && styles.chipActive]}
              >
                <Text style={[typography.caption, { color: t.status === s ? colors.white : colors.text }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[typography.caption, styles.sub]}>ASSIGNED TO</Text>
          <TextInput style={styles.input} value={assigned} onChangeText={setAssigned} placeholder="Staff name" placeholderTextColor={colors.textMuted} />
          <Text style={[typography.caption, styles.sub]}>RESOLUTION DETAILS</Text>
          <TextInput
            style={[styles.input, { minHeight: 50 }]}
            value={resolution}
            onChangeText={setResolution}
            placeholder="What was done to fix it"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              api.saveDetails(t, assigned, resolution);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            <Text style={[typography.caption, { color: colors.white, fontWeight: '600' }]}>{saved ? 'Saved' : 'Save details'}</Text>
          </TouchableOpacity>

          <Text style={[typography.caption, styles.sub]}>CONVERSATION</Text>
          {t.replies.length === 0 && <Text style={[typography.caption, { color: colors.textMuted }]}>No messages yet.</Text>}
          {t.replies.map((r, i) => (
            <View key={i} style={[styles.bubble, r.from === 'admin' ? styles.bubbleAdmin : styles.bubbleRes]}>
              <Text style={[typography.body, { color: r.from === 'admin' ? colors.white : colors.text }]}>{r.text}</Text>
              <Text style={{ fontSize: 10, color: r.from === 'admin' ? 'rgba(255,255,255,0.75)' : colors.textMuted }}>
                {r.from === 'admin' ? 'You' : t.residentName} · {fmtWhen(r.at)}
              </Text>
            </View>
          ))}
          {t.status !== 'Closed' && (
            <View style={styles.replyRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: spacing.sm }]}
                value={msg}
                onChangeText={setMsg}
                placeholder="Reply to resident"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => {
                  if (!msg.trim()) return;
                  api.reply(t, msg.trim());
                  setMsg('');
                }}
              >
                <Ionicons name="send" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminSupportScreen() {
  const navigation = useNavigation<any>();
  const api = useAdminSupport();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Open');

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: api.tickets.length };
    api.tickets.forEach((t) => (m[t.status] = (m[t.status] ?? 0) + 1));
    return m;
  }, [api.tickets]);
  const shown = filter === 'All' ? api.tickets : api.tickets.filter((t) => t.status === filter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Support Tickets</Text>
        <View style={{ width: 22 }} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} activeOpacity={0.8} style={[styles.chip, filter === f && styles.chipActive]}>
              <Text style={[typography.caption, { color: filter === f ? colors.white : colors.text }]}>
                {f}
                {counts[f] ? ` (${counts[f]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {shown.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="help-buoy-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>No tickets here</Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <TicketCard t={item} api={api} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sub: { color: colors.textMuted, marginTop: spacing.md, marginBottom: 4 },
  input: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: 14, color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md, alignSelf: 'flex-start', marginTop: spacing.sm },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs },
  bubbleAdmin: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  bubbleRes: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  sendBtn: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});