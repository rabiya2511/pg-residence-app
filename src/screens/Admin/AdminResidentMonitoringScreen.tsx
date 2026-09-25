import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { adminResidentDocuments } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import ResidentRentTrendChart from '../../components/admin/ResidentRentTrendChart';
import ResidentMonthlyRentHistory from '../../components/admin/ResidentMonthlyRentHistory';

const docStatusColors: Record<string, { bg: string; text: string }> = {
  Uploaded: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Rejected: { bg: '#FEE2E2', text: colors.error },
};

export default function AdminResidentMonitoringScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { residentId } = route.params;
  const { residents, paymentRecords } = useAdmin();

  const resident = residents.find((r) => r.id === residentId);
  const documents = adminResidentDocuments.filter((d) => d.residentId === residentId);
  const allResidentRecords = paymentRecords.filter((p) => p.residentId === residentId);

  if (!resident) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>{resident.name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
          Documents ({documents.length})
        </Text>
        {documents.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>No documents uploaded.</Text>
        ) : (
          documents.map((doc) => {
            const style = docStatusColors[doc.status];
            return (
              <View key={doc.id} style={styles.card}>
                <View style={styles.docIconWrap}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.docContent}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{doc.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {doc.uploadedOn ? `Uploaded ${doc.uploadedOn}` : 'Not uploaded'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: style.bg }]}>
                  <Text style={[typography.caption, { color: style.text }]}>{doc.status}</Text>
                </View>
              </View>
            );
          })
        )}

        <View style={{ marginTop: spacing.lg }}>
          <ResidentRentTrendChart
            payments={allResidentRecords}
            dueDay={resident.rentDueDay}
            joiningDate={resident.joiningDate}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ResidentMonthlyRentHistory
            joiningDate={resident.joiningDate}
            rentDueDay={resident.rentDueDay}
            payments={allResidentRecords}
          />
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
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  docContent: { flex: 1 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
});