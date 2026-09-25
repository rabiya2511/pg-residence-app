import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { privacySettings, privacyPolicyText } from '../../constants/mockData';
import SectionHeader from '../../components/common/SectionHeader';

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const [values, setValues] = useState<Record<string, boolean>>(
    Object.fromEntries(privacySettings.map((s) => [s.id, s.defaultValue]))
  );

  const toggle = (id: string) => {
    setValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Privacy</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SectionHeader title="Privacy Settings" />
          <View style={styles.settingsCard}>
            {privacySettings.map((setting, index) => (
              <View
                key={setting.id}
                style={[
                  styles.settingRow,
                  index !== privacySettings.length - 1 && styles.settingRowBorder,
                ]}
              >
                <View style={styles.settingText}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>
                    {setting.label}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {setting.description}
                  </Text>
                </View>
                <Switch
                  value={values[setting.id]}
                  onValueChange={() => toggle(setting.id)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Privacy Policy" />
          <View style={styles.policyCard}>
            <Text style={[typography.body, { color: colors.textMuted, lineHeight: 22 }]}>
              {privacyPolicyText}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginTop: spacing.md,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  policyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});