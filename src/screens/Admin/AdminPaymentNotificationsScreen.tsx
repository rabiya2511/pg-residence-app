import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import {
  useAdmin,
  AdminPaymentNotification,
  AdminVacateNotification,
} from '../../context/AdminContext';

// One feed item is either a payment or a vacate notification, tagged by kind
// so the list can render and route each one differently while staying in a
// single chronologically-sorted FlatList.
type FeedItem =
  | ({ kind: 'payment' } & AdminPaymentNotification)
  | ({ kind: 'vacate' } & AdminVacateNotification);

function PaymentNotificationCard({
  notification,
  onPress,
}: {
  notification: AdminPaymentNotification;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      {!notification.read && <View style={styles.unreadDot} />}
      <View style={styles.iconWrap}>
        <Ionicons name="cash-outline" size={20} color={colors.success} />
      </View>
      <View style={styles.content}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{notification.residentName}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Paid ₹{notification.amount} for {notification.month}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {notification.paidOn} · {notification.method}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function VacateNotificationCard({
  notification,
  onPress,
}: {
  notification: AdminVacateNotification;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      {!notification.read && <View style={styles.unreadDot} />}
      <View style={[styles.iconWrap, { backgroundColor: '#FEE2E2' }]}>
        <Ionicons name="exit-outline" size={20} color={colors.error} />
      </View>
      <View style={styles.content}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>{notification.residentName}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Submitted a vacate notice — vacating on {notification.vacatingDate}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminPaymentNotificationsScreen() {
  const navigation = useNavigation<any>();
  const {
    paymentNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    vacateNotifications,
    markVacateNotificationRead,
    markAllVacateNotificationsRead,
  } = useAdmin();

  const feed: FeedItem[] = [
    ...paymentNotifications.map((n) => ({ kind: 'payment' as const, ...n })),
    ...vacateNotifications.map((n) => ({ kind: 'vacate' as const, ...n })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const unreadCount = feed.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    markAllVacateNotificationsRead();
  };

  const handlePress = (item: FeedItem) => {
    if (item.kind === 'payment') {
      markNotificationRead(item.id);
      navigation.navigate('AdminResidentDetail', { residentId: item.residentId });
    } else {
      markVacateNotificationRead(item.id);
      navigation.navigate('AdminVacating');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={[typography.caption, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item) => `${item.kind}_${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No notifications yet.
          </Text>
        }
        renderItem={({ item }) =>
          item.kind === 'payment' ? (
            <PaymentNotificationCard notification={item} onPress={() => handlePress(item)} />
          ) : (
            <VacateNotificationCard notification={item} onPress={() => handlePress(item)} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
});