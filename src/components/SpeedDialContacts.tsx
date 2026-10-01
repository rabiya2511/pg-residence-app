import React, { useState, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';

/* ------------------------------------------------------------------ */
/* Contact store                                                       */
/* A tiny shared store, so the list survives switching between the    */
/* Room-Wise / Dialpad / Speed Dial tabs without needing a provider.  */
/* Contacts live in memory (like the rest of your mock data) and are  */
/* reset when the app restarts.                                        */
/* ------------------------------------------------------------------ */

export type SpeedDialContact = {
  id: string;
  name: string;
  category: string;
  phone: string;
};

export const CONTACT_CATEGORIES = [
  'Plumber',
  'Electrician',
  'Carpenter',
  'Doctor',
  'Gas',
  'Police',
  'Fire',
  'Ambulance',
  'Emergency',
  'Other',
] as const;

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Plumber: 'water',
  Electrician: 'flash',
  Carpenter: 'hammer',
  Doctor: 'medical',
  Gas: 'flame-outline',
  Police: 'shield',
  Fire: 'flame',
  Ambulance: 'medkit',
  Emergency: 'alert-circle',
  Other: 'call',
};

// India's national emergency numbers, so the list is useful from day one.
// Remove or edit these if you prefer a completely empty list.
let contacts: SpeedDialContact[] = [
  { id: 'seed-112', name: 'National Emergency', category: 'Emergency', phone: '112' },
  { id: 'seed-100', name: 'Police', category: 'Police', phone: '100' },
  { id: 'seed-101', name: 'Fire Brigade', category: 'Fire', phone: '101' },
  { id: 'seed-108', name: 'Ambulance', category: 'Ambulance', phone: '108' },
  { id: 'seed-1091', name: 'Women Helpline', category: 'Emergency', phone: '1091' },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => contacts;

export function addSpeedDialContact(input: Omit<SpeedDialContact, 'id'>) {
  contacts = [...contacts, { ...input, id: `sd-${Date.now()}` }];
  emit();
}

export function removeSpeedDialContact(id: string) {
  contacts = contacts.filter((c) => c.id !== id);
  emit();
}

export function useSpeedDialContacts(): SpeedDialContact[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const digitsOnly = (s: string) => s.replace(/\D/g, '');

// A normal mobile number (10 digits, or 91 + 10 digits) can use WhatsApp;
// short codes like 100 / 108 cannot.
function whatsappNumber(phone: string): string | null {
  const d = digitsOnly(phone);
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return null;
}

const CATEGORY_ORDER = ['Emergency', 'Police', 'Fire', 'Ambulance', 'Doctor', 'Plumber', 'Electrician', 'Carpenter', 'Gas', 'Other'];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* Drop this into the Speed Dial tab in place of the residents list.  */
/* ------------------------------------------------------------------ */

export default function SpeedDialContacts({ callingEnabled = true }: { callingEnabled?: boolean }) {
  const list = useSpeedDialContacts();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string>('Plumber');

  const sorted = [...list].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  const call = async (number: string) => {
    if (!callingEnabled) {
      Alert.alert('Calling Disabled', 'Enable calling at the top of this screen first.');
      return;
    }
    try {
      await Linking.openURL(`tel:${number.replace(/\s/g, '')}`);
    } catch {
      Alert.alert('Unable to Call', 'Could not open the phone dialer on this device.');
    }
  };

  const whatsapp = async (number: string) => {
    const wa = whatsappNumber(number);
    if (!wa) return;
    try {
      await Linking.openURL(`https://wa.me/${wa}`);
    } catch {
      Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp on this device.');
    }
  };

  const confirmDelete = (c: SpeedDialContact) => {
    Alert.alert('Remove Contact', `Remove ${c.name} from Speed Dial?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSpeedDialContact(c.id) },
    ]);
  };

  const openForm = () => {
    setName('');
    setPhone('');
    setCategory('Plumber');
    setModalVisible(true);
  };

  const handleSave = () => {
    const digits = digitsOnly(phone);
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a name, e.g. "Ravi (Plumber)".');
      return;
    }
    if (digits.length < 3 || digits.length > 15) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }
    addSpeedDialContact({ name: name.trim(), category, phone: phone.trim() });
    setModalVisible(false);
  };

  return (
    <View>
      <TouchableOpacity style={styles.addButton} activeOpacity={0.85} onPress={openForm}>
        <Ionicons name="add-circle-outline" size={20} color={colors.white} />
        <Text style={[typography.bodyBold, { color: colors.white, marginLeft: spacing.xs }]}>
          Add Emergency / Vendor Contact
        </Text>
      </TouchableOpacity>

      {sorted.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="call-outline" size={32} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            No contacts yet. Add your plumber, electrician and emergency numbers.
          </Text>
        </View>
      )}

      {sorted.map((c) => {
        const canWhatsApp = !!whatsappNumber(c.phone);
        return (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Ionicons name={CATEGORY_ICON[c.category] ?? 'call'} size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <View style={styles.phoneRow}>
                  <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]}>{c.phone}</Text>
                </View>
              </View>
              <View style={styles.categoryPill}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>{c.category}</Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmDelete(c)}
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.callButton, !canWhatsApp && { flex: 1 }]}
                activeOpacity={0.85}
                onPress={() => call(c.phone)}
              >
                <Ionicons name="call" size={16} color={colors.white} />
                <Text style={[typography.bodyBold, { color: colors.white, marginLeft: 6 }]}>Call</Text>
              </TouchableOpacity>
              {canWhatsApp && (
                <TouchableOpacity style={styles.waButton} activeOpacity={0.85} onPress={() => whatsapp(c.phone)}>
                  <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
                  <Text style={[typography.bodyBold, { color: colors.success, marginLeft: 6 }]}>WhatsApp</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>Add Contact</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[typography.caption, styles.label]}>Category</Text>
                <View style={styles.chipWrap}>
                  {CONTACT_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, category === cat && styles.chipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: category === cat ? colors.white : colors.text, fontWeight: '600' },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[typography.caption, styles.label]}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ravi - Plumber"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[typography.caption, styles.label]}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 XXXXX XXXXX"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />

                <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
                  <Text style={[typography.button, { color: colors.white }]}>Save Contact</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  categoryPill: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
  },
  deleteButton: { marginLeft: spacing.sm, padding: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  waButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.success}20`,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});