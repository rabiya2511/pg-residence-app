import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { nearbyPlaces, NearbyPlaceCategory } from '../../constants/mockData';

const categories: (NearbyPlaceCategory | 'All')[] = [
  'All',
  'Cafe',
  'Grocery/Mart',
  'Restaurant',
  'Pharmacy',
  'ATM/Bank',
  'Gym',
];

export default function NearbyPlacesScreen() {
  const navigation = useNavigation();
  const [activeCategory, setActiveCategory] = useState<NearbyPlaceCategory | 'All'>('All');

  const visiblePlaces =
    activeCategory === 'All'
      ? nearbyPlaces
      : nearbyPlaces.filter((p) => p.category === activeCategory);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Nearby Places</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Stylized mock map area */}
      <View style={styles.mapArea}>
        <View style={styles.mapGrid}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View key={i} style={styles.mapGridCell} />
          ))}
        </View>
        <View style={styles.mapPinCenter}>
          <Ionicons name="home" size={20} color={colors.white} />
        </View>
        <View style={[styles.mapPin, { top: '25%', left: '20%' }]}>
          <Ionicons name="cafe" size={14} color={colors.white} />
        </View>
        <View style={[styles.mapPin, { top: '65%', left: '30%' }]}>
          <Ionicons name="cart" size={14} color={colors.white} />
        </View>
        <View style={[styles.mapPin, { top: '35%', left: '75%' }]}>
          <Ionicons name="restaurant" size={14} color={colors.white} />
        </View>
        <View style={[styles.mapPin, { top: '70%', left: '70%' }]}>
          <Ionicons name="medkit" size={14} color={colors.white} />
        </View>
        <Text style={styles.mapLabel}> PG Residency & surrounding area</Text>
      </View>

      {/* Category filter row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryRow}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.caption,
                  { color: isActive ? colors.white : colors.text },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Places list */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {visiblePlaces.map((place) => (
          <View key={place.id} style={styles.placeCard}>
            <View style={styles.placeIconWrap}>
              <Ionicons name={place.icon as any} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{place.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {place.category} · {place.distance}
              </Text>
            </View>
            <View style={styles.ratingWrap}>
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={[typography.caption, { color: colors.text, marginLeft: 2 }]}>
                {place.rating}
              </Text>
            </View>
          </View>
        ))}
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
  mapArea: {
    height: 180,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#DDEEDD',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
   mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mapGridCell: {
    width: '25%',
    height: '25%',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mapPinCenter: {
    position: 'absolute',
    top: '45%',
    left: '45%',
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  mapPin: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  mapLabel: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 4,
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
  categoryRow: {
    marginTop: spacing.md,
    flexGrow: 0,
  },
  categoryChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});