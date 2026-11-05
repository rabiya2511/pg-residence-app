import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '@react-native-firebase/auth';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { SocialProvider, isLinked, linkSocial, unlinkSocial } from '../../services/socialAuth';

const ROWS: { key: SocialProvider; label: string; icon: string; color: string }[] = [
  { key: 'google', label: 'Google', icon: 'logo-google', color: '#DB4437' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
];

export default function LinkedAccountsCard() {
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const refresh = async () => {
    try {
      await getAuth().currentUser?.reload();
    } catch {}
    setTick((t) => t + 1);
  };

  const run = async (provider: SocialProvider, label: string) => {
    setBusy(provider);
    const res = isLinked(provider) ? await unlinkSocial(provider) : await linkSocial(provider);
    await refresh();
    setBusy(null);
    if (!res.ok && !res.cancelled) Alert.alert('Not completed', res.message);
    else if (res.ok) Alert.alert(isLinked(provider) ? 'Linked' : 'Unlinked', `${label} ${isLinked(provider) ? 'is now linked. You can use it on the login screen.' : 'was removed from your account.'}`);
  };

  const onPress = (p: SocialProvider, label: string) => {
    if (isLinked(p)) {
      Alert.alert(`Unlink ${label}?`, 'You can still sign in with your phone number.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlink', style: 'destructive', onPress: () => run(p, label) },
      ]);
    } else {
      run(p, label);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={[typography.bodyBold, { color: colors.text }]}>Linked accounts</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        Link Google or Facebook to sign in faster. Your phone number always keeps working.
      </Text>
      {ROWS.map((r) => {
        const linked = isLinked(r.key);
        return (
          <View key={r.key} style={styles.row}>
            <Ionicons name={r.icon as any} size={22} color={r.color} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.body, { color: colors.text }]}>{r.label}</Text>
              <Text style={[typography.caption, { color: linked ? colors.success : colors.textMuted }]}>
                {linked ? 'Linked' : 'Not linked'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, linked && styles.btnOutline, !!busy && { opacity: 0.6 }]}
              disabled={!!busy}
              activeOpacity={0.85}
              onPress={() => onPress(r.key, r.label)}
            >
              {busy === r.key ? (
                <ActivityIndicator size="small" color={linked ? colors.error : colors.white} />
              ) : (
                <Text style={[typography.caption, { color: linked ? colors.error : colors.white, fontWeight: '700' }]}>
                  {linked ? 'Unlink' : 'Link'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  btn: {
    minWidth: 72,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error },
});