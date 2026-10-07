import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

export default function AdminPropertiesScreen() {
  const navigation = useNavigation<any>();
  const { residents, properties, rooms, deleteProperty } = useAdmin();

  const openEdit = (propertyId: string) =>
    navigation.navigate('AdminPropertyForm', { propertyId });

  const confirmDelete = (propertyId: string, name: string, roomCount: number) => {
    Alert.alert(
      'Delete Property',
      `Delete "${name}" and its ${roomCount} room${roomCount !== 1 ? 's' : ''}?\n\nThis cannot be undone. Past payments, complaints and archived residents of this property will no longer be shown in the app.`,
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Properties</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminPropertyForm')}
          style={styles.backButton}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {properties.map((property) => {
          const propertyRooms = rooms.filter((r) => r.propertyId === property.id);
          const totalBeds = propertyRooms.reduce((sum, r) => sum + r.capacity, 0);
          const occupiedBeds = residents.filter((r) => r.propertyId === property.id).length;
          const coverImage = property.images[0];

          return (
            <TouchableOpacity
              key={property.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AdminPropertyRooms', { propertyId: property.id })}
            >
              {coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.thumbnail} />
              ) : (
                <View style={styles.iconWrap}>
                  <Ionicons name="business-outline" size={22} color={colors.primary} />
                </View>
              )}
              <View style={styles.content}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{property.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {propertyRooms.length} rooms · {occupiedBeds}/{totalBeds} beds occupied
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {property.images.length} photo{property.images.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => openEdit(property.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: spacing.xs }}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openEdit(property.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: spacing.xs }}
              >
                <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => confirmDelete(property.id, property.name, propertyRooms.length)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: spacing.xs }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {properties.length === 0 && (
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No properties yet. Tap + above to add one.
          </Text>
        )}
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
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
});