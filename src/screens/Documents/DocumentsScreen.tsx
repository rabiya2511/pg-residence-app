import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, Linking, Alert, Modal, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useDocuments } from '../../context/DocumentsContext';
import { useRent } from '../../context/RentContext';
import { useResident } from '../../context/ResidentContext';
import { useMyIssuedDocuments, docStatus, IssuedDocument } from '../../hooks/useIssuedDocuments';
import DocumentCard from '../../components/documents/DocumentCard';

const MAX_BYTES = 10 * 1024 * 1024;

const STATUS_COLOR = {
  ok: { bg: colors.successBg, fg: colors.success },
  warn: { bg: colors.amberBg, fg: '#92400E' },
  bad: { bg: colors.errorBg, fg: colors.error },
};
const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const openUrl = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert('Cannot Open', 'No app on this phone can open this file.'));

function IssuedCard({ item }: { item: IssuedDocument }) {
  const st = docStatus(item.expiryTs);
  const c = STATUS_COLOR[st.kind];
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons
          name={item.mimeType.includes('pdf') ? 'document-text-outline' : 'image-outline'}
          size={22}
          color={colors.primary}
        />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{item.category}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
          <Text style={[typography.caption, { color: c.fg, fontWeight: '700' }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        Issued {item.issuedOn}{item.expiryDate ? ` · Expires ${item.expiryDate}` : ''}
      </Text>
      <TouchableOpacity style={styles.viewBtn} activeOpacity={0.85} onPress={() => openUrl(item.fileUrl)}>
        <Ionicons name="open-outline" size={16} color={colors.white} />
        <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>View / Download</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const { documents, uploadDocument } = useDocuments();
  const { paymentHistory } = useRent();
  const { residentData } = useResident();
  const { docs: issued, loaded } = useMyIssuedDocuments();
  const [receipt, setReceipt] = useState<any | null>(null);

  // upload
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const uploadedCount = documents.filter((d) => d.status === 'Uploaded').length;

  const sections: any[] = [
    { key: 'issued', title: 'From your PG', data: issued, empty: loaded ? 'No documents have been issued to you yet.' : 'Loading…' },
    { key: 'receipts', title: 'Payment receipts', data: paymentHistory, empty: 'No paid rent yet.' },
    { key: 'uploads', title: `My uploads (${uploadedCount} of ${documents.length})`, data: documents, empty: '' },
  ];

  const runUpload = async (id: string, uri: string, mimeType?: string) => {
    setUploadingId(id);
    const result = await uploadDocument(id, uri, mimeType);
    setUploadingId(null);
    if (!result.ok) {
      Alert.alert('Upload Failed', result.message ?? 'Please try again.');
      return;
    }
    Alert.alert('Uploaded', 'Your document has been uploaded.');
  };

  const takePhoto = async (id: string) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access to take a photo of your document.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.length) {
        runUpload(id, result.assets[0].uri, 'image/jpeg');
      }
    } catch {
      Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
    }
  };

  const chooseFile = async (id: string) => {
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
      runUpload(id, a.uri, a.mimeType ?? undefined);
    } catch {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    }
  };

  const pick = (option: 'camera' | 'file') => {
    if (!target) return;
    const id = target.id;
    setTarget(null);
    // Wait for the sheet to close before opening the camera / file picker.
    setTimeout(() => (option === 'camera' ? takePhoto(id) : chooseFile(id)), 300);
  };

  const shareReceipt = () => {
    if (!receipt) return;
    Share.share({
      message:
        `Rent receipt\n` +
        `Receipt no: ${receipt.transactionId}\n` +
        `Resident: ${residentData.name} (Room ${residentData.room})\n` +
        `Month: ${receipt.month}\n` +
        `Amount paid: ${formatINR(receipt.amount)}\n` +
        `Paid on: ${receipt.paidOn}\n` +
        `Method: ${receipt.method}\n` +
        `${residentData.pgName}`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>My Documents</Text>
        <View style={{ width: 22 }} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }: any) => (
          <View style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
            <Text style={[typography.bodyBold, { color: colors.text }]}>{section.title}</Text>
            {section.data.length === 0 && !!section.empty && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{section.empty}</Text>
            )}
          </View>
        )}
        renderItem={({ item, section }: any) => {
          if (section.key === 'issued') return <IssuedCard item={item} />;
          if (section.key === 'receipts') {
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setReceipt(item)}>
                <View style={styles.row}>
                  <Ionicons name="receipt-outline" size={22} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.bodyBold, { color: colors.text }]}>{item.month}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      Paid {item.paidOn} · {item.method}
                    </Text>
                  </View>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{formatINR(item.amount)}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          // My uploads: the existing card plus Upload / Replace and View buttons.
          const uploaded = item.status === 'Uploaded';
          const busy = uploadingId === item.id;
          return (
            <View style={{ marginBottom: spacing.sm }}>
              <DocumentCard document={item} />
              <View style={styles.uploadRow}>
                {busy ? (
                  <View style={[styles.uploadBtn, { backgroundColor: colors.primaryLight }]}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 8 }]}>Uploading…</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
                      activeOpacity={0.85}
                      onPress={() => setTarget({ id: item.id, name: item.name })}
                      disabled={!!uploadingId}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={colors.white} />
                      <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>
                        {uploaded ? 'Replace' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                    {uploaded && !!item.fileUri && /^https?:/.test(item.fileUri) && (
                      <TouchableOpacity
                        style={[styles.uploadBtn, styles.uploadBtnOutline]}
                        activeOpacity={0.85}
                        onPress={() => openUrl(item.fileUri)}
                      >
                        <Ionicons name="eye-outline" size={16} color={colors.primary} />
                        <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>View</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Upload source */}
      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <TouchableOpacity style={styles.optionOverlay} activeOpacity={1} onPress={() => setTarget(null)}>
          <View style={styles.optionSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Upload {target?.name}
            </Text>
            <TouchableOpacity style={styles.optionRow} onPress={() => pick('camera')}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={() => pick('file')}>
              <Ionicons name="folder-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Choose File (PDF or image)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancel} onPress={() => setTarget(null)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Receipt */}
      <Modal visible={!!receipt} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={[typography.heading3, { color: colors.text }]}>Rent receipt</Text>
            {receipt && (
              <View style={{ marginTop: spacing.sm }}>
                {[
                  ['Receipt no', receipt.transactionId],
                  ['Resident', `${residentData.name} · Room ${residentData.room}`],
                  ['Month', receipt.month],
                  ['Amount paid', formatINR(receipt.amount)],
                  ['Paid on', receipt.paidOn],
                  ['Method', receipt.method],
                ].map(([k, v]) => (
                  <View key={k} style={styles.receiptRow}>
                    <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>{k}</Text>
                    <Text style={[typography.caption, { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.border }]} onPress={() => setReceipt(null)}>
                <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.primary }]} onPress={shareReceipt}>
                <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.xs },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, marginTop: spacing.sm },
  uploadRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingVertical: 8 },
  uploadBtnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  optionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: spacing.lg, paddingBottom: spacing.xl },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  optionCancel: { alignItems: 'center', paddingTop: spacing.md },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  receiptRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetBtn: { flex: 1, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
});