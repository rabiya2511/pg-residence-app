import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodyBold, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}>
        {value?.trim() ? value : 'Not provided'}
      </Text>
    </View>
  );
}

// ───────── Documents ─────────
type DocItem = {
  key: string;
  title: string; // e.g. "Aadhar Card · Front"
  kind: string; // e.g. "Government ID"
  detail?: string | null; // number / code
  uri: string | null;
};

// A web link to a stored file may only be shown for the resident it was saved under.
// (Pictures saved inside the record, or picked on this phone, belong to the record they are read from.)
function belongsTo(uri: string | null, residentId: string): boolean {
  if (!uri) return false;
  if (!/firebasestorage|storage\.googleapis/.test(uri)) return true; // local file picked on this device
  const decoded = decodeURIComponent(uri);
  if (/\/identity\//.test(decoded)) return decoded.includes(`/identity/${residentId}/`);
  if (/\/profiles\//.test(decoded)) return decoded.includes(`/profiles/${residentId}/`);
  if (/\/dailyGuests\//.test(decoded)) return false; // a guest's file, never a resident's
  return true;
}

const maskNumber = (n: string) => (n.length <= 4 ? n : `${'•'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`);

// Image that never breaks the screen: shows a placeholder while loading or when it can't be loaded.
function SafeImage({
  uri,
  style,
  resizeMode = 'cover',
  fallbackIcon = 'image-outline',
  iconSize = 22,
}: {
  uri: string | null;
  style: any;
  resizeMode?: 'cover' | 'contain';
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  if (!uri || failed) {
    return (
      <View style={[style, styles.imageFallback]}>
        <Ionicons name={failed ? 'alert-circle-outline' : fallbackIcon} size={iconSize} color={colors.textMuted} />
        {failed && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Can't load</Text>}
      </View>
    );
  }
  return (
    <View style={style}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { borderRadius: (style as any)?.borderRadius }]}
        resizeMode={resizeMode}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

export default function AdminResidentFullDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { residentId } = route.params;
  const { residents, identityDocuments } = useAdmin();
  const [viewing, setViewing] = useState<DocItem | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showNumber, setShowNumber] = useState(false);

  const resident = residents.find((r) => r.id === residentId);
  if (!resident) return null;
  const r: any = resident;

  // Permanent address: the field the registration form saves, with older spellings as fallback.
  const permanentAddress: string = (r.permanentAddress || r.address || r.homeAddress || '').toString();

  // Only this resident's own identity record.
  const idRecord = identityDocuments.find((d) => d.residentId === resident.id);
  const govType: string = r.idDocType || 'Government ID';
  const govNumber: string = (r.idDocNumber || '').toString();
  const officeType: string = r.officeIdType || 'Institution';

  const docs: DocItem[] = [
    { key: 'gov-front', title: `${govType} · Front`, kind: 'Government ID', detail: govNumber, uri: idRecord?.frontUri ?? null },
    { key: 'gov-back', title: `${govType} · Back`, kind: 'Government ID', detail: govNumber, uri: idRecord?.backUri ?? null },
    {
      key: 'office',
      title: `${officeType} ID Card`,
      kind: 'Institution / Occupation ID',
      detail: r.officeIdCode || null,
      uri: r.officeIdUri ?? null,
    },
    { key: 'company', title: 'Company ID Proof', kind: 'Company ID', detail: r.companyName || null, uri: r.companyIdProofUri ?? null },
  ];

  const download = async (d: DocItem) => {
    if (!d.uri || !belongsTo(d.uri, resident.id)) return;
    try {
      setBusyKey(d.key);
      const safe = `${resident.name}_${d.title}`.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
      let local = d.uri;
      if (/^data:/.test(d.uri)) {
        // Pictures are stored inside the record as data; write them to a file first.
        local = `${FileSystem.cacheDirectory}${safe}.jpg`;
        await FileSystem.writeAsStringAsync(local, d.uri.split(',')[1] ?? '', { encoding: FileSystem.EncodingType.Base64 });
      } else if (/^https?:/.test(d.uri)) {
        const res = await FileSystem.downloadAsync(d.uri, `${FileSystem.cacheDirectory}${safe}.jpg`);
        if (res.status && res.status >= 400) throw new Error(`HTTP ${res.status}`);
        local = res.uri;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(local, { mimeType: 'image/jpeg', dialogTitle: d.title });
      } else {
        Alert.alert('Downloaded', `Saved to: ${local}`);
      }
    } catch (e: any) {
      console.warn('document download failed:', e?.message ?? e);
      Alert.alert('Download Failed', 'The document could not be downloaded. Check your internet connection and try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const openExternal = (uri: string) =>
    Linking.openURL(uri).catch(() => Alert.alert('Cannot Open', 'No app available to open this file.'));

  const uploadedCount = docs.filter((d) => d.uri && belongsTo(d.uri, resident.id)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Full Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <SafeImage
            uri={resident.profileImageUri && belongsTo(resident.profileImageUri, resident.id) ? resident.profileImageUri : null}
            style={styles.avatarImage}
            fallbackIcon="person"
            iconSize={36}
          />
          <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.sm }]}>{resident.name}</Text>
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>Personal</Text>
        <View style={styles.infoCard}>
          <DetailRow label="Phone" value={resident.phone} />
          <View style={styles.divider} />
          <DetailRow label="Email" value={resident.email} />
          <View style={styles.divider} />
          <DetailRow label="Gender" value={resident.gender} />
        </View>

        {/* ---------------- Identity & Address ---------------- */}
        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Identity & Address
        </Text>
        <View style={styles.infoCard}>
          <View style={styles.addressBlock}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Permanent Address</Text>
            <Text style={[typography.bodyBold, { color: permanentAddress.trim() ? colors.text : colors.textMuted, marginTop: 4 }]}>
              {permanentAddress.trim() ? permanentAddress.trim() : 'Not provided — add it from Edit Resident.'}
            </Text>
          </View>
          <View style={styles.divider} />
          <DetailRow label="Native Place" value={resident.nativePlace} />
          {!!govNumber && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={[typography.body, { color: colors.textMuted }]}>{govType} No.</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setShowNumber((p) => !p)}>
                  <Text style={[typography.bodyBold, { color: colors.text }]}>{showNumber ? govNumber : maskNumber(govNumber)}</Text>
                  <Ionicons name={showNumber ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.docsHeader}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>Documents</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {uploadedCount} of {docs.length} uploaded
          </Text>
        </View>

        {docs.map((d) => {
          const owned = !d.uri || belongsTo(d.uri, resident.id);
          const has = !!d.uri && owned;
          const isPdf = !!d.uri && /\.pdf(\?|$)/i.test(d.uri);
          return (
            <View key={d.key} style={styles.docCard}>
              {has && !isPdf ? (
                <SafeImage uri={d.uri} style={styles.docThumb} />
              ) : (
                <View style={[styles.docThumb, styles.imageFallback]}>
                  <Ionicons name={isPdf ? 'document-text-outline' : 'image-outline'} size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={2}>{d.title}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {d.kind}
                  {d.detail ? ` · ${d.key.startsWith('gov') ? maskNumber(d.detail) : d.detail}` : ''}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: !owned ? '#FEE2E2' : has ? '#D1FAE5' : '#FEF3C7' },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: !owned ? colors.error : has ? colors.success : colors.warning, fontWeight: '700' },
                    ]}
                  >
                    {!owned ? 'Blocked · not this resident' : has ? 'Uploaded' : 'Not uploaded'}
                  </Text>
                </View>
              </View>
              {has && (
                <View style={{ gap: spacing.xs }}>
                  <TouchableOpacity
                    style={styles.docAction}
                    onPress={() => (isPdf ? openExternal(d.uri as string) : setViewing(d))}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.primary} />
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.docAction} onPress={() => download(d)} disabled={busyKey === d.key}>
                    {busyKey === d.key ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="download-outline" size={16} color={colors.primary} />
                    )}
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>Download</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Occupation
        </Text>
        <View style={styles.infoCard}>
          <DetailRow label="Occupation" value={resident.occupation} />
          <View style={styles.divider} />
          <DetailRow label="Work Address" value={resident.occupationAddress} />
        </View>

        <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Emergency Contacts
        </Text>
        <View style={styles.infoCard}>
          <DetailRow label="Contact 1" value={resident.emergencyContact1} />
          <View style={styles.divider} />
          <DetailRow label="Contact 2" value={resident.emergencyContact2} />
        </View>
      </ScrollView>

      {/* Full-screen document viewer */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerBar}>
            <Text style={[typography.bodyBold, { color: colors.white, flex: 1 }]} numberOfLines={1}>
              {viewing?.title}
            </Text>
            <TouchableOpacity onPress={() => viewing && download(viewing)} style={styles.viewerBtn}>
              <Ionicons name="download-outline" size={22} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewing(null)} style={styles.viewerBtn}>
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          <SafeImage uri={viewing?.uri ?? null} style={styles.viewerImage} resizeMode="contain" iconSize={40} />
        </View>
      </Modal>
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
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatarImage: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  imageFallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  addressBlock: { paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  docsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  docThumb: { width: 72, height: 54, borderRadius: radius.sm, overflow: 'hidden' },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  docAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minWidth: 96,
  },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  viewerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  viewerBtn: { padding: spacing.sm },
  viewerImage: { flex: 1, margin: spacing.sm, backgroundColor: 'transparent', borderWidth: 0 },
});