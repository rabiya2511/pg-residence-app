import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { AdminDailyGuest, AdminDailyGuestPaymentMethod, PG_UPI_ID, PG_PAYEE_NAME } from '../../constants/mockData';
import { useAdmin } from '../../context/AdminContext';
import { DailyGuestRegistrationForm } from './AdminDailyGuestFormScreen';
import {
  addDays,
  DAY_MS,
  depositPaidOf,
  formatGuestDate,
  guestDue,
  guestRate,
  parseGuestDate,
  rangesOverlap,
  startOfDay,
  stayCheckIn,
  stayEnd,
  stayState,
  StayState,
} from '../../utils/dailyGuestHelpers';

type Tab = 'dashboard' | 'new' | 'history';
type StayFilter = 'all' | 'active' | 'upcoming' | 'extended' | 'checkedOut';

const PAY_MODES: AdminDailyGuestPaymentMethod[] = ['UPI', 'Cash', 'Card', 'Bank Transfer'];
const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATE_STYLE: Record<StayState, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: '#D1FAE5', text: colors.success },
  upcoming: { label: 'Upcoming', bg: '#DBEAFE', text: colors.primary },
  ended: { label: 'Stay Ended', bg: '#FEE2E2', text: colors.error },
  checkedOut: { label: 'Checked Out', bg: '#E5E7EB', text: colors.textMuted },
};

function buildUpiLink(amount: number, note: string): string {
  const params = new URLSearchParams({ pa: PG_UPI_ID, pn: PG_PAYEE_NAME, am: amount.toFixed(2), cu: 'INR', tn: note });
  return `upi://pay?${params.toString()}`;
}

function waDigits(phone: string): string {
  let d = (phone ?? '').replace(/[^\d]/g, '');
  if (d.length === 10) d = `91${d}`;
  return d;
}

const callGuest = (phone: string) =>
  Linking.openURL(`tel:${(phone ?? '').replace(/\s/g, '')}`).catch(() => Alert.alert('Unable to Call', 'Could not open the dialer.'));

const whatsappGuest = (phone: string) =>
  Linking.openURL(`https://wa.me/${waDigits(phone)}`).catch(() =>
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.')
  );

// ───────────────────────── pieces ─────────────────────────

function Tile({ label, value, icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileTop}>
        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.tileIcon, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
      </View>
      <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.xs }]}>{value}</Text>
    </View>
  );
}

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  return (
    <View style={styles.avatar}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} />
      ) : (
        <Text style={[typography.bodyBold, { color: colors.white }]}>{(name.trim().charAt(0) || '?').toUpperCase()}</Text>
      )}
    </View>
  );
}

function StayCard({
  guest,
  roomLabel,
  onOpen,
  onCollect,
  onExtend,
  onCheckout,
}: {
  guest: AdminDailyGuest;
  roomLabel: string;
  onOpen: () => void;
  onCollect: () => void;
  onExtend: () => void;
  onCheckout: () => void;
}) {
  const state = stayState(guest);
  const st = STATE_STYLE[state];
  const due = guestDue(guest);
  const extended = (guest.extendedDays ?? 0) > 0 && state !== 'checkedOut';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onOpen}>
      <View style={styles.cardTop}>
        <Avatar name={guest.name} uri={guest.profileImageUri} />
        <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
          <View style={styles.pillRow}>
            <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {guest.name}
            </Text>
            <View style={[styles.pill, { backgroundColor: st.bg }]}>
              <Text style={[typography.caption, { color: st.text, fontWeight: '700' }]}>{st.label}</Text>
            </View>
            {extended && (
              <View style={[styles.pill, { backgroundColor: '#FFEDD5' }]}>
                <Text style={[typography.caption, { color: '#EA580C', fontWeight: '700' }]}>Extended +{guest.extendedDays}d</Text>
              </View>
            )}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {roomLabel}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {guest.checkInDate} → {guest.vacatingDate} · {guest.numDays} day{guest.numDays > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{money(guest.totalAmount)}</Text>
          {due.total > 0 ? (
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>{money(due.total)} due</Text>
          ) : (
            <Text style={[typography.caption, { color: colors.success, fontWeight: '700' }]}>Paid</Text>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => callGuest(guest.phone)}>
          <Ionicons name="call" size={17} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => whatsappGuest(guest.phone)}>
          <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {state !== 'checkedOut' && due.total > 0 && (
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.success }]} onPress={onCollect}>
            <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Collect</Text>
          </TouchableOpacity>
        )}
        {(state === 'active' || state === 'ended') && (
          <TouchableOpacity style={[styles.smallBtn, styles.outlineBtn]} onPress={onExtend}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Extend</Text>
          </TouchableOpacity>
        )}
        {state !== 'checkedOut' && state !== 'upcoming' && (
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.error }]} onPress={onCheckout}>
            <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Check Out</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ───────────────────────── screen ─────────────────────────

export default function AdminDailyGuestsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { dailyGuests, rooms, properties, recordDailyGuestPayment, updateDailyGuest } = useAdmin();

  const [tab, setTab] = useState<Tab>(route.params?.tab === 'new' ? 'new' : 'dashboard');
  const [filter, setFilter] = useState<StayFilter>('all');
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [formKey, setFormKey] = useState(0);

  // collect-payment modal
  const [payGuest, setPayGuest] = useState<AdminDailyGuest | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<AdminDailyGuestPaymentMethod>('Cash');

  // extend-stay modal
  const [extendGuest, setExtendGuest] = useState<AdminDailyGuest | null>(null);
  const [extendBy, setExtendBy] = useState(1);

  const roomOf = (g: AdminDailyGuest) => rooms.find((r) => r.id === g.roomId);
  const roomLabel = (g: AdminDailyGuest) => {
    const r = roomOf(g);
    return `${r ? `Room ${r.roomNumber}` : 'Room —'}${g.bedNumber ? ` · Bed ${g.bedNumber}` : ''}`;
  };

  // ----- dashboard numbers -----
  const todayStart = startOfDay(new Date()).getTime();
  const isToday = (ts: number) => ts >= todayStart && ts < todayStart + DAY_MS;

  const stats = useMemo(() => {
    const active = dailyGuests.filter((g) => stayState(g) === 'active').length;
    const checkInsToday = dailyGuests.filter((g) => isToday(g.checkInTimestamp)).length;
    const checkOutsToday = dailyGuests.filter((g) => {
      if (g.checkedOut) return !!g.checkedOutAt && isToday(g.checkedOutAt);
      return parseGuestDate(g.vacatingDate)?.getTime() === todayStart;
    }).length;
    const collectionsToday = dailyGuests.reduce((sum, g) => {
      if (g.payments && g.payments.length > 0) {
        return sum + g.payments.filter((p) => isToday(p.at)).reduce((s, p) => s + p.amount, 0);
      }
      // older guests have no payment log: count the advance on their check-in day
      return isToday(g.checkInTimestamp) ? sum + (g.advanceAmount ?? 0) : sum;
    }, 0);
    const pending = dailyGuests.reduce((sum, g) => sum + guestDue(g).total, 0);
    const extended = dailyGuests.filter((g) => (g.extendedDays ?? 0) > 0 && !g.checkedOut).length;
    return { active, checkInsToday, checkOutsToday, collectionsToday, pending, extended };
  }, [dailyGuests]);

  // ----- filters -----
  const matchesFilter = (g: AdminDailyGuest, f: StayFilter) => {
    const s = stayState(g);
    switch (f) {
      case 'active':
        return s === 'active' || s === 'ended';
      case 'upcoming':
        return s === 'upcoming';
      case 'extended':
        return (g.extendedDays ?? 0) > 0 && s !== 'checkedOut';
      case 'checkedOut':
        return s === 'checkedOut';
      default:
        return true;
    }
  };

  const matchesSearch = (g: AdminDailyGuest, q: string) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    const r = roomOf(g);
    return (
      g.name.toLowerCase().includes(t) ||
      (g.phone ?? '').replace(/\s/g, '').includes(t.replace(/\s/g, '')) ||
      (r?.roomNumber ?? '').toLowerCase().includes(t)
    );
  };

  const FILTERS: { key: StayFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'extended', label: 'Extended' },
    { key: 'checkedOut', label: 'Checked Out' },
  ];

  const visibleStays = useMemo(
    () =>
      [...dailyGuests]
        .filter((g) => matchesFilter(g, filter) && matchesSearch(g, search))
        .sort((a, b) => b.checkInTimestamp - a.checkInTimestamp),
    [dailyGuests, filter, search, rooms]
  );

  const historyStays = useMemo(
    () =>
      dailyGuests
        .filter((g) => g.checkedOut && matchesSearch(g, historySearch))
        .sort((a, b) => (b.checkedOutAt ?? 0) - (a.checkedOutAt ?? 0)),
    [dailyGuests, historySearch, rooms]
  );

  // ----- actions -----
  const openCollect = (g: AdminDailyGuest) => {
    setPayGuest(g);
    setPayAmount(String(guestDue(g).total));
    setPayMode('Cash');
  };

  const payDue = payGuest ? guestDue(payGuest).total : 0;
  const payEntered = Math.min(payDue, Math.max(0, Number(payAmount) || 0));

  const confirmCollect = () => {
    if (!payGuest || payEntered <= 0) return;
    recordDailyGuestPayment(payGuest.id, payEntered, payMode);
    setPayGuest(null);
  };

  const openExtend = (g: AdminDailyGuest) => {
    setExtendGuest(g);
    setExtendBy(1);
  };

  const confirmExtend = () => {
    const g = extendGuest;
    if (!g) return;
    const oldEnd = stayEnd(g);
    const newEnd = addDays(oldEnd, extendBy);
    const rate = guestRate(g);

    // Don't extend into a stay that someone else has booked for the same bed.
    if (g.bedNumber !== undefined) {
      const clash = dailyGuests.find(
        (o) =>
          o.id !== g.id &&
          !o.checkedOut &&
          o.roomId === g.roomId &&
          o.bedNumber === g.bedNumber &&
          rangesOverlap(addDays(oldEnd, 1), newEnd, stayCheckIn(o), stayEnd(o))
      );
      if (clash) {
        Alert.alert('Bed Already Booked', `${clash.name} has this bed booked from ${clash.checkInDate}. Please choose fewer days.`);
        return;
      }
    }

    const newTotal = g.totalAmount + rate * extendBy;
    updateDailyGuest(g.id, {
      numDays: g.numDays + extendBy,
      vacatingDate: formatGuestDate(newEnd),
      totalAmount: newTotal,
      dailyRate: rate,
      extendedDays: (g.extendedDays ?? 0) + extendBy,
      paymentStatus: (g.advanceAmount ?? 0) >= newTotal ? 'Paid' : 'Pending',
    });
    setExtendGuest(null);
  };

  const checkOutGuest = (g: AdminDailyGuest) => {
    const due = guestDue(g).total;
    Alert.alert(
      'Check Out Guest',
      due > 0
        ? `${g.name} still has ${money(due)} pending. Check out anyway?`
        : `Check out ${g.name}? Their bed will be freed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: () =>
            updateDailyGuest(g.id, {
              checkedOut: true,
              checkedOutOn: formatGuestDate(new Date()),
              checkedOutAt: Date.now(),
            }),
        },
      ]
    );
  };

  const refundDeposit = (g: AdminDailyGuest) =>
    Alert.alert('Deposit Refund', `Mark the ${money(depositPaidOf(g))} security deposit as refunded to ${g.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Refunded',
        onPress: () => updateDailyGuest(g.id, { depositRefunded: true, depositRefundedOn: formatGuestDate(new Date()) }),
      },
    ]);

  const openReceipt = (g: AdminDailyGuest) => navigation.navigate('AdminDailyGuestReceipt', { guestId: g.id });

  // ----- header pieces -----
  const propertyLabel =
    properties.length === 0
      ? 'No property yet'
      : properties.length === 1
      ? properties[0].name
      : `${properties[0].name} +${properties.length - 1} more`;

  const dashboardHeader = (
    <View>
      <View style={styles.checkInCard}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Daily Base Stay Check-In</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            Instant short-term bed allocation, ID logging & advance rent
          </Text>
        </View>
        <TouchableOpacity style={styles.newStayBtn} activeOpacity={0.85} onPress={() => setTab('new')}>
          <Ionicons name="person-add" size={16} color={colors.white} />
          <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>New Stay Registration</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tileGrid}>
        <Tile label="Total Active Stays" value={stats.active} icon="bed" color={colors.success} />
        <Tile label="Today's Check-ins" value={stats.checkInsToday} icon="log-in-outline" color={colors.warning} />
        <Tile label="Today's Check-outs" value={stats.checkOutsToday} icon="log-out-outline" color={colors.error} />
        <Tile label="Today's Collections" value={money(stats.collectionsToday)} icon="cash-outline" color="#CA8A04" />
        <Tile label="Pending Payments" value={money(stats.pending)} icon="warning-outline" color={colors.error} />
        <Tile label="Extended Stays" value={stats.extended} icon="refresh-circle-outline" color={colors.primary} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.warning} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by guest name, phone, room no..."
          placeholderTextColor={colors.textMuted}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chipRow}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const count = dailyGuests.filter((g) => matchesFilter(g, f.key)).length;
          return (
            <TouchableOpacity key={f.key} style={[styles.chip, on && styles.chipActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.chipText, { color: on ? colors.white : colors.text }]}>
                {f.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[typography.bodyBold, { color: colors.text, marginVertical: spacing.sm }]}>
        Stay Registrations ({visibleStays.length})
      </Text>
    </View>
  );

  const historyHeader = (
    <View>
      <Text style={[typography.heading3, { color: colors.text }]}>Historical Stay Records & Archives</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
        Archive of completed stays, deposit settlements and inspection records
      </Text>
      <View style={[styles.searchRow, { marginTop: spacing.md, marginBottom: spacing.md }]}>
        <Ionicons name="search" size={18} color={colors.warning} />
        <TextInput
          style={styles.searchInput}
          value={historySearch}
          onChangeText={setHistorySearch}
          placeholder="Search history by guest name, room..."
          placeholderTextColor={colors.textMuted}
        />
        {!!historySearch && (
          <TouchableOpacity onPress={() => setHistorySearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          Daily Base – Stay Registration
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminPreBookingProperties')} style={styles.backButton}>
          <Ionicons name="calendar-outline" size={21} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.propertyBar}>
        <View style={styles.dot} />
        <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {propertyLabel}
        </Text>
        <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>Short-Term & Daily Registrations</Text>
      </View>

      <View style={styles.tabRow}>
        {([
          ['dashboard', 'Dashboard & Stays'],
          ['new', '+ New Registration'],
          ['history', 'Stay History'],
        ] as [Tab, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setTab(key)}>
            <Text style={[typography.caption, { color: tab === key ? colors.warning : colors.text, fontWeight: '700' }]}>{label}</Text>
            {tab === key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'dashboard' && (
        <>
          <FlatList
            data={visibleStays}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={dashboardHeader}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="bed-outline" size={44} color={colors.textMuted} />
                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                  No stay registrations found matching your criteria.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <StayCard
                guest={item}
                roomLabel={roomLabel(item)}
                onOpen={() => openReceipt(item)}
                onCollect={() => openCollect(item)}
                onExtend={() => openExtend(item)}
                onCheckout={() => checkOutGuest(item)}
              />
            )}
          />
          <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setTab('new')}>
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: 6 }]}>New Stay</Text>
          </TouchableOpacity>
        </>
      )}

      {tab === 'new' && (
        <DailyGuestRegistrationForm
          key={formKey}
          initialRoomId={route.params?.roomId}
          initialPropertyId={route.params?.propertyId}
          onSaved={(guestId) => {
            setFormKey((k) => k + 1); // a fresh blank form next time
            setTab('dashboard');
            navigation.navigate('AdminDailyGuestReceipt', { guestId });
          }}
          onCancel={() => {
            setFormKey((k) => k + 1);
            setTab('dashboard');
          }}
        />
      )}

      {tab === 'history' && (
        <FlatList
          data={historyStays}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={historyHeader}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="archive-outline" size={44} color={colors.textMuted} />
              <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>No archived check-outs found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const heldDeposit = depositPaidOf(item);
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openReceipt(item)}>
                <View style={styles.cardTop}>
                  <Avatar name={item.name} uri={item.profileImageUri} />
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{roomLabel(item)}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {item.checkInDate} → {item.vacatingDate} · {item.numDays} day{item.numDays > 1 ? 's' : ''}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Checked out on {item.checkedOutOn}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{money(item.totalAmount)}</Text>
                    <Text style={[typography.caption, { color: colors.success }]}>Paid {money(item.advanceAmount ?? 0)}</Text>
                  </View>
                </View>

                {heldDeposit > 0 && (
                  <View style={styles.depositRow}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={item.depositRefunded ? colors.success : colors.warning} />
                    <Text style={[typography.caption, { color: colors.text, flex: 1, marginLeft: 6 }]}>
                      {item.depositRefunded
                        ? `Deposit ${money(heldDeposit)} refunded on ${item.depositRefundedOn}`
                        : `Deposit ${money(heldDeposit)} held`}
                    </Text>
                    {!item.depositRefunded && (
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.success }]} onPress={() => refundDeposit(item)}>
                        <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Mark Refunded</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Collect payment */}
      <Modal visible={!!payGuest} transparent animationType="fade" onRequestClose={() => setPayGuest(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPayGuest(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <Text style={[typography.heading3, { color: colors.text }]}>Collect Payment</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {payGuest?.name} · {money(payDue)} pending
            </Text>

            <Text style={[typography.caption, styles.modalLabel]}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={payAmount}
              onChangeText={(t) => setPayAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[typography.caption, styles.modalLabel]}>Payment Mode</Text>
            <View style={styles.modeRow}>
              {PAY_MODES.map((m) => (
                <TouchableOpacity key={m} style={[styles.chip, payMode === m && styles.chipActive]} onPress={() => setPayMode(m)}>
                  <Text style={[styles.chipText, { color: payMode === m ? colors.white : colors.text }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {payMode === 'UPI' && payEntered > 0 && (
              <View style={styles.qrCard}>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Scan to pay {money(payEntered)}</Text>
                <QRCode value={buildUpiLink(payEntered, `Payment for ${payGuest?.name ?? 'Day Guest'}`)} size={160} />
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{PG_UPI_ID}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, payEntered <= 0 && { opacity: 0.5 }]}
              disabled={payEntered <= 0}
              onPress={confirmCollect}
            >
              <Text style={[typography.button, { color: colors.white }]}>Confirm {money(payEntered)} Received</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setPayGuest(null)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Extend stay */}
      <Modal visible={!!extendGuest} transparent animationType="fade" onRequestClose={() => setExtendGuest(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setExtendGuest(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <Text style={[typography.heading3, { color: colors.text }]}>Extend Stay</Text>
            {extendGuest && (
              <>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {extendGuest.name} · currently until {formatGuestDate(stayEnd(extendGuest))}
                </Text>

                <View style={styles.extendStepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setExtendBy((d) => Math.max(1, d - 1))}>
                    <Ionicons name="remove" size={22} color={colors.warning} />
                  </TouchableOpacity>
                  <Text style={[typography.heading3, { color: colors.text }]}>
                    +{extendBy} Day{extendBy > 1 ? 's' : ''}
                  </Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setExtendBy((d) => Math.min(60, d + 1))}>
                    <Ionicons name="add" size={22} color={colors.warning} />
                  </TouchableOpacity>
                </View>

                <View style={styles.extendSummary}>
                  <View style={styles.sumRow}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>New check-out date</Text>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>
                      {formatGuestDate(addDays(stayEnd(extendGuest), extendBy))}
                    </Text>
                  </View>
                  <View style={styles.sumRow}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      Extra rent ({extendBy} × {money(guestRate(extendGuest))})
                    </Text>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{money(guestRate(extendGuest) * extendBy)}</Text>
                  </View>
                  <View style={styles.sumRow}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>New stay total</Text>
                    <Text style={[typography.bodyBold, { color: colors.primary }]}>
                      {money(extendGuest.totalAmount + guestRate(extendGuest) * extendBy)}
                    </Text>
                  </View>
                </View>
              </>
            )}
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmExtend}>
              <Text style={[typography.button, { color: colors.white }]}>Confirm Extension</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setExtendGuest(null)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs, marginRight: spacing.xs },
  propertyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning, marginRight: spacing.sm },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: colors.warning },
  listContent: { padding: spacing.md, paddingBottom: 110 },

  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  newStayBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warning, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tile: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  tileTop: { flexDirection: 'row', alignItems: 'center' },
  tileIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginTop: spacing.md },
  searchInput: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  chipText: { fontSize: 13, fontWeight: '700' },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  iconBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  outlineBtn: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  depositRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  emptyBox: { alignItems: 'center', marginTop: spacing.xl, padding: spacing.lg },

  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    height: 52,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  modalLabel: { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 15 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  qrCard: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  cancelLink: { alignItems: 'center', paddingVertical: spacing.md },
  extendStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: spacing.md },
  stepBtn: { padding: spacing.xs },
  extendSummary: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
});