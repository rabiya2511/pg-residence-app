import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import SwitchBranchSheet from './SwitchBranchSheet';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'PG';

export default function AdminPropertiesScreen() {
  const navigation = useNavigation<any>();
  const { properties, deleteProperty, activeProperty, setActiveProperty } = useAdmin();
  const [query, setQuery] = useState('');
  const [switchVisible, setSwitchVisible] = useState(false);

  const activeId = activeProperty?.id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.name, p.address, p.addressDetails?.city, p.addressDetails?.landmark]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [properties, query]);

  const openEdit = (propertyId: string) => navigation.navigate('AdminPropertyForm', { propertyId });
  const openDashboard = () => navigation.navigate('AdminTabs', { screen: 'Dashboard' });

  const confirmDelete = (propertyId: string, name: string) => {
    Alert.alert(
      'Delete Property',
      `Delete "${name}" and all its rooms?\n\nThis cannot be undone. Past payments, complaints and archived residents of this property will no longer be shown in the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteProperty(propertyId);
            if (!result.ok) {
              Alert.alert('Cannot Delete', result.message ?? 'Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="business" size={26} color={colors.white} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.heading3, { color: colors.text }]} numberOfLines={1}>Property Management</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            Admin Multi-Property Portfolio & Settings
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
            {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ---------------- Info banner ---------------- */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="settings" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>Multi-Property Central Configuration</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Add, edit, or configure logos, rules, UPI QR payment codes, and social links independently for each property.
            </Text>
          </View>
        </View>

        {/* ---------------- Search + Add ---------------- */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={colors.primary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search properties by name, address,"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminPropertyForm')}
          >
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: 4 }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>Configured Properties ({filtered.length})</Text>
          <TouchableOpacity style={styles.switchBtn} activeOpacity={0.85} onPress={() => setSwitchVisible(true)}>
            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>Switch Branch</Text>
          </TouchableOpacity>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          Tap a card to set it as Active
        </Text>

        {/* ---------------- Property cards ---------------- */}
        {filtered.map((property) => {
          const isActive = property.id === activeId;
          const city = property.addressDetails?.city;
          const floors = property.floors ?? 0;
          const logo = property.logoUri || property.images?.[0];

          return (
            <TouchableOpacity
              key={property.id}
              style={[styles.card, isActive && styles.cardActive]}
              activeOpacity={0.9}
              onPress={() => setActiveProperty(property.id)}
            >
              <View style={styles.cardTop}>
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.logoBox} />
                ) : (
                  <View style={[styles.logoBox, styles.logoFallback]}>
                    <Text style={styles.logoText}>{initialsOf(property.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                      {property.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="location" size={14} color={colors.primary} />
                    <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]} numberOfLines={1}>
                      {city ? `${city} • ` : ''}{floors} Floor{floors !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={styles.idChip}>
                    <Text style={styles.idChipText} numberOfLines={1}>ID: {property.id.slice(0, 8)}</Text>
                  </View>
                  {isActive && (
                    <View style={styles.activePill}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>Active</Text>
                    </View>
                  )}
                </View>
              </View>

              {!!property.address && (
                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]} numberOfLines={2}>
                  {property.address}
                </Text>
              )}

              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{property.logoUri ? 'Custom Logo' : 'Default Logo'}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{property.upiId ? 'UPI Set' : 'No UPI'}</Text>
                </View>
                <View style={[styles.chip, property.houseGuidelines ? styles.chipOn : null]}>
                  <Text style={[styles.chipText, property.houseGuidelines ? { color: colors.primary } : null]}>
                    {property.houseGuidelines ? 'Rules Ready' : 'No Rules'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>STANDARD RENT</Text>
                  <Text style={[typography.bodyBold, { color: colors.primary, marginTop: 4 }]}>
                    {property.standardRent ? `₹${property.standardRent.toLocaleString('en-IN')}` : '—'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>MANAGER</Text>
                  <Text style={[typography.bodyBold, { color: colors.text, marginTop: 4 }]} numberOfLines={1}>
                    {property.branchManager || 'Unassigned'}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.infoLabel}>PHONE</Text>
                  <Text style={[typography.bodyBold, { color: colors.text, marginTop: 4 }]} numberOfLines={1}>
                    {property.contactPhone || 'None'}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                {/* View rooms */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('AdminPropertyRooms', { propertyId: property.id })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.iconAction}
                >
                  <Ionicons name="eye" size={24} color={colors.primary} />
                </TouchableOpacity>
                {/* Configure (logo, UPI, rules, links) */}
                <TouchableOpacity
                  onPress={() => openEdit(property.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.iconAction}
                >
                  <Ionicons name="settings" size={22} color={colors.primary} />
                </TouchableOpacity>
                {/* Edit details */}
                <TouchableOpacity
                  onPress={() => openEdit(property.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.iconAction}
                >
                  <Ionicons name="pencil" size={22} color={colors.textMuted} />
                </TouchableOpacity>
                {/* Delete */}
                <TouchableOpacity
                  onPress={() => confirmDelete(property.id, property.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.iconAction}
                >
                  <Ionicons name="trash" size={22} color={colors.error} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.openButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    setActiveProperty(property.id);
                    if (isActive) openDashboard();
                  }}
                >
                  <Text style={[typography.button, { color: colors.white }]}>
                    {isActive ? 'Active · Open' : 'Set Active'}
                  </Text>
                  {isActive && <Ionicons name="arrow-forward" size={18} color={colors.white} style={{ marginLeft: 6 }} />}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {properties.length === 0 && (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No properties yet. Tap Add to create one.
          </Text>
        )}
        {properties.length > 0 && filtered.length === 0 && (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No properties match "{query}".
          </Text>
        )}
      </ScrollView>

      {/* ---------------- Selected active branch bar ---------------- */}
      {activeProperty && (
        <View style={styles.bottomBar}>
          {activeProperty.logoUri ? (
            <Image source={{ uri: activeProperty.logoUri }} style={styles.barLogo} />
          ) : (
            <View style={[styles.barLogo, styles.logoFallback]}>
              <Text style={[styles.logoText, { fontSize: 16 }]}>{initialsOf(activeProperty.name)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={{ flex: 1, marginHorizontal: spacing.sm }}
            activeOpacity={0.8}
            onPress={() => setSwitchVisible(true)}
          >
            <Text style={styles.infoLabel}>SELECTED ACTIVE BRANCH ⇅</Text>
            <Text style={[typography.bodyBold, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
              {activeProperty.name}
            </Text>
            <Text style={[typography.caption, { color: colors.primary }]} numberOfLines={1}>
              {activeProperty.addressDetails?.city ? `${activeProperty.addressDetails.city} • ` : ''}ID: {activeProperty.id.slice(0, 8)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dashButton} activeOpacity={0.85} onPress={openDashboard}>
            <Ionicons name="grid" size={18} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginHorizontal: 6 }]}>Dashboard</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}

      <SwitchBranchSheet
        visible={switchVisible}
        onClose={() => setSwitchVisible(false)}
        properties={properties}
        activeId={activeId}
        onPick={(id) => {
          setActiveProperty(id);
          setSwitchVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs, marginRight: spacing.xs },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    backgroundColor: `${colors.primary}20`,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginLeft: spacing.sm,
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}12`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, marginLeft: spacing.sm },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    marginLeft: spacing.sm,
  },

  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}12`,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardActive: { borderColor: colors.primary, borderWidth: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  logoBox: { width: 56, height: 56, borderRadius: radius.md },
  logoFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  idChip: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: 150,
  },
  idChipText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.xs,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  infoPanel: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  iconAction: { padding: spacing.sm, marginRight: spacing.xs },
  openButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  barLogo: { width: 48, height: 48, borderRadius: radius.md },
  dashButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
});