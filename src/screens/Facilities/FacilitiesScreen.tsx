import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useFacilities, FACILITY_SECTIONS } from '../../hooks/useFacilities';

export default function FacilitiesScreen() {
  const navigation = useNavigation<any>();
  const { data, loading } = useFacilities();
  const [shown, setShown] = useState<Record<number, boolean>>({});

  const call = (num: string) => {
    const d = num.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${d}`).catch(() => Alert.alert('Cannot Call', `Please dial ${num} manually.`));
  };

  const wifi = (data?.wifi ?? []).filter((w) => w.network || w.password);
  const emergency = (data?.emergency ?? []).filter((e) => e.phone);
  const sections = FACILITY_SECTIONS.filter((s) => !!(data?.[s.key] ?? '').toString().trim());
  const empty = !loading && wifi.length === 0 && emergency.length === 0 && sections.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Facilities & Info</Text>
        <View style={{ width: 22 }} />
      </View>

      {empty ? (
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            Your PG hasn't added facility details yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          {wifi.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="wifi-outline" size={20} color={colors.primary} />
                <Text style={[typography.bodyBold, styles.cardTitle]}>Wi-Fi</Text>
              </View>
              {wifi.map((w, i) => (
                <View key={i} style={[styles.wifiRow, i > 0 && styles.wifiDivider]}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{w.floor || 'All floors'}</Text>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{w.network || '—'}</Text>
                  {!!w.password && (
                    <TouchableOpacity onPress={() => setShown((p) => ({ ...p, [i]: !p[i] }))} style={styles.pwRow} activeOpacity={0.7}>
                      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                        Password: {shown[i] ? w.password : '••••••••'}
                      </Text>
                      <Ionicons name={shown[i] ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {sections.map((s) => (
            <View key={s.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name={s.icon as any} size={20} color={colors.primary} />
                <Text style={[typography.bodyBold, styles.cardTitle]}>{s.label}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text }]}>{String(data?.[s.key])}</Text>
            </View>
          ))}

          {emergency.length > 0 && (
            <View style={[styles.card, { borderColor: colors.error }]}>
              <View style={styles.cardHead}>
                <Ionicons name="call-outline" size={20} color={colors.error} />
                <Text style={[typography.bodyBold, styles.cardTitle]}>Emergency Contacts</Text>
              </View>
              {emergency.map((e, i) => (
                <TouchableOpacity key={i} style={styles.emRow} onPress={() => call(e.phone)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{e.label || 'Contact'}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{e.phone}</Text>
                  </View>
                  <View style={styles.callBtn}>
                    <Ionicons name="call" size={16} color={colors.white} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { color: colors.text, marginLeft: spacing.sm },
  wifiRow: { paddingVertical: spacing.xs },
  wifiDivider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
  pwRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  emRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  callBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
});