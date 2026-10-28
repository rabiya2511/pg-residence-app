import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isPreBookedNow } from '../../context/AdminContext';

export default function AdminPreBookingPropertiesScreen() {
  const navigation = useNavigation<any>();
  const { residents, properties, activeProperty } = useAdmin();

  // Pre-bookings are residents reserved ahead of check-in (same rule as the dashboard
  // and Resident Management). The app loads one property at a time, so the active one is shown.
  const preBooked = residents.filter((r) => isPreBookedNow(r));
  const shown = activeProperty ? [activeProperty] : properties;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Pre-Bookings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {shown.length === 0 && (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No property yet.
          </Text>
        )}
        {shown.map((property) => {
          const count = preBooked.filter((r) => r.propertyId === property.id).length;
          return (
            <TouchableOpacity
              key={property.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AdminPreBookingList', { propertyId: property.id })}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="business-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.content}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{property.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {count} pre-booking{count !== 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
});