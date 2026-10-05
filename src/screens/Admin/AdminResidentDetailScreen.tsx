import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import ResidentRentTrendChart from '../../components/admin/ResidentRentTrendChart';

const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#D1FAE5', text: colors.success },
  Pending: { bg: '#FEF3C7', text: colors.warning },
  Overdue: { bg: '#FEE2E2', text: colors.error },
  Open: { bg: '#FEE2E2', text: colors.error },
  'In Progress': { bg: '#FEF3C7', text: colors.warning },
  Resolved: { bg: '#D1FAE5', text: colors.success },
};

function handleMessage(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`sms:${cleaned}`).catch(() => {
    Alert.alert('Unable to Message', 'Could not open the messaging app.');
  });
}

function handleCall(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Unable to Call', 'Could not open the dialer.');
  });
}

function handleWhatsApp(phone: string) {
  const cleaned = phone.replace(/[^\d]/g, '');
  Linking.openURL(`https://wa.me/${cleaned}`).catch(() => {
    Alert.alert('Unable to Open WhatsApp', 'Please make sure WhatsApp is installed.');
  });
}

// ───────── Emergency contacts ─────────
type ContactEntry = { key: string; label: string; display: string; dial: string };

// Dialable form of a number: digits and a leading +, no spaces or dashes.
const dialable = (raw: string) => raw.replace(/[^\d+]/g, '');
const hasEnoughDigits = (raw: string) => raw.replace(/\D/g, '').length >= 7;

// Collects every emergency contact the resident gave. Handles values saved as plain
// text ("98765 43210") and as objects ({ name, relation, phone }), for fields named
// emergencyContact, emergencyContact1, emergencyContact2 and so on. The father /
// guardian number is included as well, since it is the other person to call.
function getEmergencyContacts(resident: any): ContactEntry[] {
  const entries: ContactEntry[] = [];
  const seen = new Set<string>();

  const add = (key: string, label: string, display: string, rawNumber: string) => {
    if (!rawNumber || !hasEnoughDigits(rawNumber)) return;
    const dial = dialable(rawNumber);
    const id = dial.replace(/^\+?91/, '').slice(-10);
    if (seen.has(id)) return;
    seen.add(id);
    entries.push({ key, label, display, dial });
  };

  Object.keys(resident)
    .filter((k) => /^emergencyContact\d*$/i.test(k))
    .sort()
    .forEach((k, i) => {
      const v = resident[k];
      if (!v) return;
      // Label by the field's own number (emergencyContact2 -> "Emergency Contact 2"),
      // so a resident who only gave a second contact is not shown as "1".
      const n = k.match(/\d+$/)?.[0] ?? String(i + 1);
      if (typeof v === 'string') {
        add(k, `Emergency Contact ${n}`, v.trim(), v);
      } else if (typeof v === 'object') {
        const number: string = v.phone ?? v.number ?? v.mobile ?? '';
        const who = [v.name, v.relation].filter(Boolean).join(' · ');
        add(k, who || `Emergency Contact ${n}`, number, number);
      }
    });

  if (resident.guardianPhone) {
    add(
      'guardian',
      resident.guardianName ? `${resident.guardianName} (Father / Guardian)` : 'Father / Guardian',
      String(resident.guardianPhone),
      String(resident.guardianPhone)
    );
  }

  return entries;
}

export default function AdminResidentDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { residentId } = route.params;
  // `properties` now comes from the live admin data (it used to be the static
  // mock list, so properties created in the app showed as "—").
  const { residents, complaints, markRentPaid, rooms, properties, paymentRecords } = useAdmin();

  // Opens / closes the rent payment trend under the "View Documents & Payments" button.
  const [showTrend, setShowTrend] = useState(false);

  const resident = residents.find((r) => r.id === residentId);
  const residentComplaints = complaints.filter((c) => c.residentName === resident?.name);

  if (!resident) return null;

  const rentStatusStyle = statusColors[resident.rentStatus];

  const residentRoom = rooms.find((r) => r.id === resident.roomId);
  const residentProperty = properties.find((p) => p.id === resident.propertyId);

  const fullRoomHistory = (resident.roomHistory ?? []).slice().reverse();
  const residentPayments = paymentRecords.filter((p) => p.residentId === resident.id);
  const emergencyContacts = getEmergencyContacts(resident);

  const handleMarkPaid = () => {
    Alert.alert('Mark Rent as Paid', `Confirm ₹${resident.monthlyRent} received from ${resident.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => markRentPaid(resident.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Resident Details</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminResidentForm', { residentId: resident.id })}
          style={styles.backButton}
        >
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.sm }]}>
            {resident.name}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{resident.phone}</Text>

          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactButton}
              activeOpacity={0.8}
              onPress={() => handleMessage(resident.phone)}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              activeOpacity={0.8}
              onPress={() => handleCall(resident.phone)}
            >
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              activeOpacity={0.8}
              onPress={() => handleWhatsApp(resident.phone)}
            >
              <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
              <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Room</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              {residentRoom ? `${residentRoom.roomNumber} (${residentRoom.capacity} Sharing)` : '—'}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Property</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>
              {residentProperty?.name ?? '—'}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Joined</Text>
            <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.joiningDate}</Text>
          </View>
        </View>

        {/* Emergency contacts: tap a row to call, or the WhatsApp icon to message */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Emergency Contacts
        </Text>
        {emergencyContacts.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>No emergency contacts added.</Text>
        ) : (
          <View style={styles.infoCard}>
            {emergencyContacts.map((c, i) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.emergencyRow, i > 0 && styles.infoRowBorder]}
                activeOpacity={0.8}
                onPress={() => handleCall(c.dial)}
              >
                <View style={styles.emergencyIcon}>
                  <Ionicons name="call" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{c.label}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{c.display}</Text>
                </View>
                <TouchableOpacity hitSlop={10} onPress={() => handleWhatsApp(c.dial)} style={styles.emergencyAction}>
                  <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity hitSlop={10} onPress={() => handleCall(c.dial)} style={styles.emergencyAction}>
                  <Ionicons name="call-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {fullRoomHistory.length > 0 && (
          <>
            <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Room History
            </Text>
            {fullRoomHistory.map((h) => {
              const histRoom = rooms.find((r) => r.id === h.roomId);
              const histProperty = properties.find((p) => p.id === h.propertyId);
              const isCurrent = h.toDate === null;
              return (
                <View key={h.id} style={styles.historyCard}>
                  <View style={styles.historyIconWrap}>
                    <Ionicons
                      name={isCurrent ? 'checkmark-circle-outline' : 'time-outline'}
                      size={18}
                      color={isCurrent ? colors.success : colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.historyTitleRow}>
                      <Text style={[typography.bodyBold, { color: colors.text }]}>
                        {histRoom
                          ? `${histRoom.roomNumber} (${histRoom.capacity} Sharing) · Floor ${histRoom.floor}`
                          : 'Unknown Room'}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={[typography.caption, { color: colors.success }]}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {histProperty?.name ?? 'Unknown Property'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {h.fromDate} – {isCurrent ? 'Present' : h.toDate}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* View Documents & Payments: opens the rent payment trend right here */}
        <TouchableOpacity
          style={styles.monitoringButton}
          activeOpacity={0.85}
          onPress={() => setShowTrend((prev) => !prev)}
        >
          <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.primary, marginLeft: spacing.xs }]}>
            View Documents & Payments
          </Text>
          <Ionicons
            name={showTrend ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primary}
            style={{ marginLeft: spacing.xs }}
          />
        </TouchableOpacity>

        {showTrend && (
          <View style={{ marginTop: spacing.sm }}>
            <ResidentRentTrendChart
              payments={residentPayments}
              dueDay={resident.rentDueDay}
              joiningDate={resident.joiningDate}
            />
            <TouchableOpacity
              style={styles.openFullButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AdminResidentMonitoring', { residentId: resident.id })}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                Open documents & payment history
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* View More: opens the Full Details screen */}
        <TouchableOpacity
          style={styles.monitoringButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AdminResidentFullDetails', { residentId: resident.id })}
        >
          <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.primary, marginLeft: spacing.xs }]}>View More</Text>
        </TouchableOpacity>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Rent
        </Text>
        <View style={styles.rentCard}>
          <View>
            <Text style={[typography.heading2, { color: colors.text }]}>₹{resident.monthlyRent}</Text>
            <View style={[styles.badge, { backgroundColor: rentStatusStyle.bg, marginTop: 4 }]}>
              <Text style={[typography.caption, { color: rentStatusStyle.text }]}>
                {resident.rentStatus}
              </Text>
            </View>
          </View>
          {resident.rentStatus !== 'Paid' && (
            <TouchableOpacity style={styles.markPaidButton} activeOpacity={0.85} onPress={handleMarkPaid}>
              <Text style={[typography.button, { color: colors.white }]}>Mark as Paid</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Complaints ({residentComplaints.length})
        </Text>
        {residentComplaints.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>No complaints raised.</Text>
        ) : (
          residentComplaints.map((c) => {
            const style = statusColors[c.status];
            return (
              <View key={c.id} style={styles.complaintCard}>
                <View style={styles.headerRow}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{c.category}</Text>
                  <View style={[styles.badge, { backgroundColor: style.bg }]}>
                    <Text style={[typography.caption, { color: style.text }]}>{c.status}</Text>
                  </View>
                </View>
                <Text style={[typography.body, { color: colors.textMuted, marginTop: 2 }]}>
                  {c.description}
                </Text>
              </View>
            );
          })
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
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contactRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },

  contactButton: {
    alignItems: 'center',
  },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  emergencyAction: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  historyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },

  currentBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  monitoringButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },

  openFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },

  rentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  markPaidButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },

  complaintCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
                                        
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});