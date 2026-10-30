import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
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
  const isReminder = !!notification.reminder;
  const daysLeft = notification.daysLeft ?? 0;
  const title = isReminder
    ? daysLeft === 0
      ? 'Vacating today'
      : daysLeft === 1
      ? 'Vacating tomorrow'
      : `Vacating in ${daysLeft} days`
    : null;

  return (
    <TouchableOpacity
      style={[styles.card, isReminder && styles.reminderCard]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {!notification.read && <View style={styles.unreadDot} />}
      <View style={[styles.iconWrap, { backgroundColor: isReminder ? '#FFEDD5' : '#FEE2E2' }]}>
        <Ionicons
          name={isReminder ? 'alarm-outline' : 'exit-outline'}
          size={20}
          color={isReminder ? '#EA580C' : colors.error}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
            {notification.residentName}
          </Text>
          {isReminder && (
            <View style={[styles.badge, daysLeft === 0 && { backgroundColor: colors.error }]}>
              <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>{title}</Text>
            </View>
          )}
        </View>
        {isReminder ? (
          <>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Reminder: {notification.message ?? `Vacating on ${notification.vacatingDate}`}
            </Text>
            {notification.isEmergency && (
              <Text style={[typography.caption, { color: colors.error }]}>Emergency vacate</Text>
            )}
          </>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Submitted a vacate notice — vacating on {notification.vacatingDate}
          </Text>
        )}
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
    clearNotifications,
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

  const handleClearData = () => {
    Alert.alert(
      'Clear Notifications',
      `Delete all ${feed.length} notification${feed.length !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: () => clearNotifications(['payment', 'vacate']),
        },
      ]
    );
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
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={[typography.caption, { color: colors.primary }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {feed.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClearData} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={14} color={colors.error} />
          <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginLeft: 4 }]}>
            Clear Data
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={feed}
        keyExtractor={(item) => `${item.kind}_${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No notifications.
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
  headerActions: { minWidth: 80, alignItems: 'flex-end' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginRight: spacing.md,
    marginBottom: spacing.sm,
  },
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
  reminderCard: {
    borderColor: '#FB923C',
    backgroundColor: '#FFF7ED',
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
  },
});