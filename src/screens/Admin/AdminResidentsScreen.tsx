import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminResident, Room, Property } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
};

function getRoomNumber(rooms: Room[], roomId: string): string {
  return rooms.find((r) => r.id === roomId)?.roomNumber ?? 'Unassigned';
}

function getPropertyName(properties: Property[], propertyId: string): string {
  return properties.find((p) => p.id === propertyId)?.name ?? 'Unknown Property';
}

function handleCall(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Unable to Call', 'Could not open the dialer.');
  });
}

function handleWhatsAppReminder(resident: AdminResident, roomNumber: string) {
  const cleaned = resident.phone.replace(/[^\d]/g, '');
  const message = `Hi ${resident.name}, this is a reminder that your rent of ₹${resident.monthlyRent} (Room ${roomNumber}) is currently ${resident.rentStatus}. Please make the payment at your earliest convenience. — Sunrise PG Residency`;
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

function ResidentCard({
  resident,
  rooms,
  properties,
  onPress,
  onEdit,
  onDelete,
}: {
  resident: AdminResident;
  rooms: Room[];
  properties: Property[];
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusStyle = statusColors[resident.rentStatus];
  const hasDues = resident.rentStatus !== 'Paid';
  const roomNumber = getRoomNumber(rooms, resident.roomId);
  const propertyName = getPropertyName(properties, resident.propertyId);
  // Green when rent is Paid, red for Pending or Overdue — mirrors the same
  // rentStatus badge already shown next to the name.
  const nameColor = resident.rentStatus === 'Paid' ? colors.success : colors.error;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.avatarWrap}>
        {resident.profileImageUri ? (
          <Image source={{ uri: resident.profileImageUri }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={22} color={colors.primary} />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.cardHeaderRow}>
          <Text style={[typography.bodyBold, { color: nameColor }]}>{resident.name}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[typography.caption, { color: statusStyle.text }]}>
              {resident.rentStatus}
            </Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          Room {roomNumber} · {propertyName}
        </Text>
        <View style={styles.phoneRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{resident.phone}</Text>
          {hasDues && (
            <View style={styles.phoneActions}>
              <TouchableOpacity
                style={styles.phoneActionButton}
                onPress={() => handleCall(resident.phone)}
              >
                <Ionicons name="call-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.phoneActionButton}
                onPress={() => handleWhatsAppReminder(resident, roomNumber)}
              >
                <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.rowIconButton} onPress={onEdit}>
        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.rowIconButton} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function AdminResidentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const filterRentStatus: 'PendingOrOverdue' | undefined = route.params?.filterRentStatus;
  const { residents, deleteResident, rooms, properties } = useAdmin();

  const visibleResidents = filterRentStatus
    ? residents.filter((r) => r.rentStatus === 'Pending' || r.rentStatus === 'Overdue')
    : residents;

  const handleDelete = (resident: AdminResident) => {
    const roomNumber = getRoomNumber(rooms, resident.roomId);
    Alert.alert(
      'Remove Resident',
      `Remove ${resident.name} from Room ${roomNumber}? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteResident(resident.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[typography.heading2, { color: colors.text }]}>
            {filterRentStatus ? 'Pending Rent' : 'Residents'}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {visibleResidents.length} total
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminResidentForm', {})}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={visibleResidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ResidentCard
            resident={item}
            rooms={rooms}
            properties={properties}
            onPress={() => navigation.navigate('AdminResidentDetail', { residentId: item.id })}
            onEdit={() => navigation.navigate('AdminResidentForm', { residentId: item.id })}
            onDelete={() => handleDelete(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
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
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  content: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneActions: {
    flexDirection: 'row',
  },
  phoneActionButton: {
    marginLeft: spacing.sm,
    padding: 2,
  },
  rowIconButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});