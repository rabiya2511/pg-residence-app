import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useRules, RULE_SECTIONS } from '../../hooks/useRules';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function RulesScreen() {
  const navigation = useNavigation<any>();
  const { residentId } = useMockAuth();
  const { residents, properties } = useAdmin();
  const { data, loading, acknowledged, acknowledge } = useRules();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const pgName = properties.find((p) => p.id === residents.find((r) => r.id === residentId)?.propertyId)?.name ?? 'PG';
  const sections = RULE_SECTIONS.filter((s) => !!(data?.[s.key] ?? '').toString().trim());

  const downloadPdf = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const body = sections
        .map((s) => `<h2>${esc(s.label)}</h2><p>${esc(String(data[s.key]))}</p>`)
        .join('');
      const html = `<html><body style="font-family: Arial; padding: 24px; color: #111;">
        <h1 style="margin-bottom:0">${esc(pgName)}</h1>
        <p style="color:#666;margin-top:4px">Rules &amp; Regulations · Last updated ${fmtDate(data.updatedAt)}</p>
        ${body}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'PG Rules & Regulations' });
      } else {
        Alert.alert('Saved', 'PDF created, but sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Could not create PDF', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Rules & Regulations</Text>
        <TouchableOpacity onPress={downloadPdf} disabled={!data || busy} style={{ padding: spacing.xs }}>
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="download-outline" size={22} color={data ? colors.primary : colors.border} />}
        </TouchableOpacity>
      </View>

      {!loading && (!data || sections.length === 0) ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            Your PG hasn't published its rules yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {!!data && (
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              Last updated {fmtDate(data.updatedAt)}
            </Text>
          )}

          {!!data && !acknowledged && (
            <View style={styles.ackBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={[typography.caption, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
                {data.version > 1 ? 'The rules were updated.' : 'Please read the rules.'} Review and acknowledge them below.
              </Text>
            </View>
          )}

          {sections.map((s) => {
            const expanded = open[s.key] ?? true;
            return (
              <View key={s.key} style={styles.card}>
                <TouchableOpacity style={styles.cardHead} activeOpacity={0.7} onPress={() => setOpen((p) => ({ ...p, [s.key]: !expanded }))}>
                  <Ionicons name={s.icon as any} size={20} color={colors.primary} />
                  <Text style={[typography.bodyBold, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>{s.label}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {expanded && <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>{String(data?.[s.key])}</Text>}
              </View>
            );
          })}
        </ScrollView>
      )}

      {!!data && sections.length > 0 && (
        <View style={styles.footer}>
          {acknowledged ? (
            <View style={styles.ackDone}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[typography.bodyBold, { color: colors.success, marginLeft: spacing.xs }]}>You have acknowledged these rules</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.ackBtn} onPress={acknowledge} activeOpacity={0.85}>
              <Text style={[typography.button, { color: colors.white }]}>I have read and agree</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  ackBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  ackBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  ackDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
});