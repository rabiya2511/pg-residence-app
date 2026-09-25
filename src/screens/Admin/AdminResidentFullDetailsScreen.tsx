import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}>
        {value?.trim() ? value : 'Not provided'}
      </Text>
    </View>
  );
}

export default function AdminResidentFullDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { residentId } = route.params;
  const { residents } = useAdmin();

  const resident = residents.find((r) => r.id === residentId);
  if (!resident) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Full Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          {resident.profileImageUri ? (
            <Image source={{ uri: resident.profileImageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color={colors.textMuted} />
            </View>
          )}
          <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.sm }]}>
            {resident.name}
          </Text>
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
          Personal
        </Text>
        <View style={styles.infoCard}>
          <DetailRow label="Phone" value={resident.phone} />
          <View style={styles.divider} />
          <DetailRow label="Email" value={resident.email} />
          <View style={styles.divider} />
          <DetailRow label="Gender" value={resident.gender} />
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Occupation
        </Text>
        <View style={styles.infoCard}>
          <DetailRow label="Occupation" value={resident.occupation} />
          <View style={styles.divider} />
          <DetailRow label="Work Address" value={resident.occupationAddress} />
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Other
        </Text>
        <View style={styles.infoCard}>
          <DetailRow label="Native Place" value={resident.nativePlace} />
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Emergency Contacts
        </Text>
        <View style={styles.infoCard}>
          <DetailRow label="Contact 1" value={resident.emergencyContact1} />
          <View style={styles.divider} />
          <DetailRow label="Contact 2" value={resident.emergencyContact2} />
        </View>
                <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Company ID Proof
        </Text>
        <View style={styles.infoCard}>
          {resident.companyIdProofUri ? (
            <Image source={{ uri: resident.companyIdProofUri }} style={styles.idProofImage} />
          ) : (
            <Text style={[typography.body, { color: colors.textMuted, padding: spacing.md }]}>
              Not uploaded
            </Text>
          )}
        </View>
      </ScrollView>
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
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatarImage: { width: 88, height: 88, borderRadius: radius.full },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
    idProofImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.sm,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});