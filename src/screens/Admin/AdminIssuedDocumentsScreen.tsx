import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, TextInput, Alert,
  ActivityIndicator, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { useAdminIssuedDocuments, DOC_CATEGORIES, docStatus, DocGroup } from '../../hooks/useIssuedDocuments';

const MAX_BYTES = 10 * 1024 * 1024;
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const sizeLabel = (n?: number) => (n ? `${(n / 1024 / 1024).toFixed(1)} MB` : '');

const STATUS_COLOR = {
  ok: { bg: colors.successBg, fg: colors.success },
  warn: { bg: colors.amberBg, fg: '#92400E' },
  bad: { bg: colors.errorBg, fg: colors.error },
};

export default function AdminIssuedDocumentsScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, activeProperty } = useAdmin();
  const { groups, loaded, issue, remove } = useAdminIssuedDocuments();

  const [formOpen, setFormOpen] = useState(false);
  const [toAll, setToAll] = useState(true);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(DOC_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string; size?: number } | null>(null);
  const [sending, setSending] = useState(false);

  const roomOf = (roomId: string) => rooms.find((r) => r.id === roomId)?.roomNumber ?? '';

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents
      .filter((r) => !q || r.name.toLowerCase().includes(q) || roomOf(r.roomId).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [residents, rooms, search]);

  const openForm = () => {
    setToAll(true);
    setResidentId(null);
    setSearch('');
    setCategory(DOC_CATEGORIES[0]);
    setTitle('');
    setExpiry(null);
    setShowPicker(false);
    setFile(null);
    setFormOpen(true);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      if (a.size && a.size > MAX_BYTES) {
        Alert.alert('File Too Large', 'Please choose a file smaller than 10 MB.');
        return;
      }
      setFile({ uri: a.uri, name: a.name ?? 'document', mimeType: a.mimeType ?? '', size: a.size });
    } catch {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    }
  };

  const submit = async () => {
    if (sending) return;
    const fail = (t: string, m: string) => Alert.alert(t, m);
    if (!toAll && !residentId) return fail('Recipient', 'Choose the resident who should receive this document.');
    if (title.trim().length < 2) return fail('Title', 'Please enter a title for the document.');
    if (!file) return fail('File', 'Please choose a PDF or an image to send.');
    if (expiry && expiry.getTime() < new Date().setHours(0, 0, 0, 0)) {
      return fail('Expiry Date', 'The expiry date cannot be in the past.');
    }

    setSending(true);
    const result = await issue({
      recipient: toAll ? 'all' : (residentId as string),
      category,
      title,
      fileUri: file.uri,
      fileName: file.name,
      mimeType: file.mimeType,
      expiry,
    });
    setSending(false);

    if (!result.ok) {
      // The form stays filled in so nothing has to be typed again.
      Alert.alert('Could Not Send', result.message ?? 'Please try again.');
      return;
    }
    setFormOpen(false);
    Alert.alert('Document Sent', toAll ? 'Every resident can now see this document.' : 'The resident can now see this document.');
  };

  const confirmDelete = (g: DocGroup) => {
    Alert.alert(
      'Delete Document',
      g.count > 1
        ? `Remove "${g.doc.title}" from all ${g.count} residents? This cannot be undone.`
        : `Remove "${g.doc.title}" from ${g.doc.residentName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await remove(g.groupId);
            if (!result.ok) Alert.alert('Could Not Delete', result.message ?? 'Please try again.');
          },
        },
      ]
    );
  };

  const openFile = (url: string) =>
    Linking.openURL(url).catch(() => Alert.alert('Cannot Open', 'No app on this phone can open this file.'));

  const renderItem = ({ item: g }: { item: DocGroup }) => {
    const d = g.doc;
    const st = docStatus(d.expiryTs);
    const c = STATUS_COLOR[st.kind];
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Ionicons
            name={d.mimeType.includes('pdf') ? 'document-text-outline' : 'image-outline'}
            size={22}
            color={colors.primary}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{d.title}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{d.category}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[typography.caption, { color: c.fg, fontWeight: '700' }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.text, marginTop: spacing.xs }]}>
          To: {g.count > 1 || d.scope === 'all' ? `All residents (${g.count})` : d.residentName}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
          Issued {d.issuedOn}{d.expiryDate ? ` · Expires ${d.expiryDate}` : ''}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => openFile(d.fileUrl)}>
            <Text style={[typography.caption, styles.btnText]}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => confirmDelete(g)}>
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const chip = (text: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity key={text} style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '600' }]}>{text}</Text>
    </TouchableOpacity>
  );
  const label = (t: string) => <Text style={[typography.caption, styles.label]}>{t}</Text>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Issue Documents</Text>
          {!!activeProperty?.name && <Text style={[typography.caption, { color: colors.textMuted }]}>{activeProperty.name}</Text>}
        </View>
        <View style={{ width: 22 }} />
      </View>

      {!loaded ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-attach-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            No documents issued yet.{'\n'}Tap + to send an agreement, receipt or notice.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.groupId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={openForm}>
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => !sending && setFormOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.heading3, { color: colors.text }]}>Send a document</Text>
                <TouchableOpacity onPress={() => !sending && setFormOpen(false)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {label('Send to')}
                <View style={styles.wrap}>
                  {chip('All residents', toAll, () => setToAll(true))}
                  {chip('One resident', !toAll, () => setToAll(false))}
                </View>
                {!toAll && (
                  <>
                    <TextInput
                      style={styles.input}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search by name or room..."
                      placeholderTextColor={colors.textMuted}
                    />
                    <View style={styles.residentList}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {matches.length === 0 && (
                          <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.md }]}>No residents match.</Text>
                        )}
                        {matches.map((r) => {
                          const sel = r.id === residentId;
                          return (
                            <TouchableOpacity key={r.id} style={[styles.option, sel && styles.optionSel]} onPress={() => setResidentId(r.id)}>
                              <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                                {r.name}{roomOf(r.roomId) ? ` · Room ${roomOf(r.roomId)}` : ''}
                              </Text>
                              {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}

                {label('Category')}
                <View style={styles.wrap}>{DOC_CATEGORIES.map((c) => chip(c, category === c, () => setCategory(c)))}</View>

                {label('Title')}
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Rental agreement 2026"
                  placeholderTextColor={colors.textMuted}
                />

                {label('Expiry date (optional)')}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity style={[styles.input, { flex: 1, flexDirection: 'row', justifyContent: 'space-between' }]} onPress={() => setShowPicker(true)}>
                    <Text style={[typography.body, { color: expiry ? colors.text : colors.textMuted }]}>
                      {expiry ? fmt(expiry) : 'No expiry'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  {!!expiry && (
                    <TouchableOpacity onPress={() => setExpiry(null)} style={{ marginLeft: spacing.sm }}>
                      <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {showPicker && (
                  <DateTimePicker
                    value={expiry ?? new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={(_e: any, d?: Date) => {
                      setShowPicker(Platform.OS === 'ios');
                      if (d) setExpiry(d);
                    }}
                  />
                )}

                {label('File (PDF or image, up to 10 MB)')}
                <TouchableOpacity style={styles.fileBtn} onPress={pickFile} activeOpacity={0.8}>
                  <Ionicons name="attach-outline" size={20} color={colors.primary} />
                  <Text style={[typography.body, { color: file ? colors.text : colors.primary, marginLeft: spacing.xs, flex: 1 }]} numberOfLines={1}>
                    {file ? `${file.name} ${sizeLabel(file.size)}` : 'Choose file'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.sheetButtons}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setFormOpen(false)} disabled={sending}>
                    <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }, sending && { opacity: 0.7 }]}
                    onPress={submit}
                    disabled={sending}
                  >
                    {sending ? <ActivityIndicator color={colors.white} /> : <Text style={[typography.caption, styles.btnText]}>Send Document</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface },
  btnText: { color: colors.white, fontWeight: '700' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  sheetButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  label: { color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.text, fontSize: 15 },
  residentList: { maxHeight: 160, marginTop: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionSel: { backgroundColor: colors.primaryLight },
  fileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: spacing.md },
});