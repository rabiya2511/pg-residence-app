import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { faqs, supportContact } from '../../constants/mockData';
import SectionHeader from '../../components/common/SectionHeader';
import FAQAccordionItem from '../../components/help/FAQAccordionItem';
import { useAdmin } from '../../context/AdminContext';
import { useMockAuth } from '../../context/MockAuthContext';
import { useSupportTickets, ticketColor, fmtWhen } from '../../hooks/useSupportTickets';

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

export default function HelpSupportScreen() {
  const navigation = useNavigation<any>();
  const { residentId } = useMockAuth();
  const { residents, properties } = useAdmin();
  const { tickets } = useSupportTickets();

  // Use the resident's own PG contact; fall back to the general support contact.
  const resident = residents.find((r) => r.id === residentId);
  const property = properties.find((p) => p.id === resident?.propertyId);
  const phone = property?.contactPhone || supportContact.phone;
  const managerName = property?.branchManager || supportContact.wardenName;

  const call = (num: string) =>
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Unable to Call', `Please dial ${num} manually.`));

  const whatsapp = () => {
    const d = digits(phone);
    const full = d.length === 10 ? `91${d}` : d;
    Linking.openURL(`https://wa.me/${full}`).catch(() =>
      Alert.alert('WhatsApp not available', 'Install WhatsApp or call the management instead.')
    );
  };

  const email = () =>
    Linking.openURL(`mailto:${supportContact.email}`).catch(() =>
      Alert.alert('No Email App Found', `You can reach us at ${supportContact.email}`)
    );

  const activeCount = tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length;

  const ContactCard = ({ icon, label, onPress, tint }: { icon: any; label: string; onPress: () => void; tint?: string }) => (
    <TouchableOpacity style={styles.contactCard} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name={icon} size={22} color={tint ?? colors.primary} />
      <Text style={[typography.caption, { color: colors.text, marginTop: 4, textAlign: 'center' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Help & Support</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contactRow}>
          <ContactCard icon="call-outline" label="Call Admin" onPress={() => call(phone)} />
          <ContactCard icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} tint="#25D366" />
          <ContactCard icon="mail-outline" label="Email" onPress={email} />
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
          {managerName ? `Manager / Warden: ${managerName}` : ''}
          {phone ? `  ·  ${phone}` : ''}
        </Text>

        <TouchableOpacity style={styles.emergency} activeOpacity={0.85} onPress={() => call(phone)}>
          <Ionicons name="warning-outline" size={20} color={colors.white} />
          <Text style={[typography.bodyBold, { color: colors.white, marginLeft: spacing.sm }]}>Emergency — call management now</Text>
        </TouchableOpacity>

        {/* Support tickets */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <SectionHeader title={`My Support Tickets${activeCount ? ` (${activeCount} active)` : ''}`} />
          </View>
          <TouchableOpacity style={styles.newButton} activeOpacity={0.85} onPress={() => navigation.navigate('SupportChat')}>
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Raise a Support Ticket</Text>
          </TouchableOpacity>

          {tickets.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>
              No tickets yet. Raise one and the manager will reply here.
            </Text>
          ) : (
            tickets.map((t) => {
              const c = ticketColor(t.status);
              const last = t.replies[t.replies.length - 1];
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.ticketCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('SupportChat', { ticketId: t.id })}
                >
                  <View style={styles.rowBetween}>
                    <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>{t.subject}</Text>
                    <View style={[styles.badge, { backgroundColor: c.bg }]}>
                      <Text style={[typography.caption, { color: c.text, fontWeight: '600' }]}>{t.status}</Text>
                    </View>
                  </View>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    #{t.id.slice(0, 6).toUpperCase()} · {t.category} · {fmtWhen(t.createdAt)}
                  </Text>
                  {last?.from === 'admin' && (
                    <Text style={[typography.caption, { color: colors.primary, marginTop: 4 }]} numberOfLines={1}>
                      Manager: {last.text}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Frequently Asked Questions" />
          {faqs.map((faq) => (
            <FAQAccordionItem key={faq.id} faq={faq} />
          ))}
        </View>
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
  contactRow: { flexDirection: 'row', justifyContent: 'space-between' },
  contactCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  section: { marginTop: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.xs },
});