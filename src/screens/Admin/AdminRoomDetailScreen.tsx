import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { properties } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

export default function AdminRoomDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomId } = route.params;
  const { residents, rooms } = useAdmin();

  const room = rooms.find((r) => r.id === roomId);
  const property = room ? properties.find((p) => p.id === room.propertyId) : undefined;
  const roommates = residents.filter((r) => r.roomId === roomId);
  const remaining = room ? room.capacity - roommates.length : 0;
  const isFull = remaining <= 0;

  if (!room) return null;

  const handleAddResident = () => {
    if (isFull) {
      Alert.alert('Room Full', 'This room has no beds remaining. Add the resident to a different room.');
      return;
    }
    navigation.navigate('AdminResidentForm', { propertyId: room.propertyId, roomId: room.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>{room.roomNumber}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminRoomForm', { roomId: room.id })}
          style={styles.backButton}
        >
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{property?.name}</Text>
          <Text style={[typography.heading3, { color: colors.text, marginTop: 2 }]}>
            {room.capacity} Sharing · {roommates.length}/{room.capacity} beds occupied
          </Text>
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Roommates ({roommates.length})
        </Text>
        {roommates.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>No residents in this room yet.</Text>
        ) : (
          roommates.map((resident) => (
            <TouchableOpacity
              key={resident.id}
              style={styles.residentCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AdminResidentDetail', { residentId: resident.id })}
            >
              <View style={styles.avatarWrap}>
                <Ionicons name="person" size={20} color={colors.primary} />
              </View>
              <View style={styles.content}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{resident.phone}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{resident.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[styles.addButton, isFull && styles.addButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleAddResident}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>
            {isFull ? 'Room Full' : 'Add Resident'}
          </Text>
        </TouchableOpacity>
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  residentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
});