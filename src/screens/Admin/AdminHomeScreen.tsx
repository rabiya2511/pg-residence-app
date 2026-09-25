import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';

export default function AdminHomeScreen() {
  const { logout } = useMockAuth();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[typography.heading1, { color: colors.text }]}>Admin Dashboard</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
        Coming soon
      </Text>
      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.85}>
        <Text style={[typography.button, { color: colors.white }]}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});