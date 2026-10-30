import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Switch,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isAdLiveNow, AdminAd } from '../../context/AdminContext';
import AdPopupModal from '../../components/common/AdPopupModal';

const MAX_NOTE = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const QUICK_DAYS = [3, 7, 15, 30];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
// Today counts as day 1, so "until today" = 1 day.
const daysShown = (end: Date) => Math.round((startOfDay(end).getTime() - startOfDay(new Date()).getTime()) / DAY_MS) + 1;

// ---- image helpers (same approach as the resident form) ----
async function pickImageFromFiles(onPicked: (uri: string) => void) {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length) onPicked(result.assets[0].uri);
  } catch {
    Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
  }
}

async function takePhotoWithCamera(onPicked: (uri: string) => void) {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.length) onPicked(result.assets[0].uri);
  } catch {
    Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
  }
}

export default function AdminAdsScreen() {
  const navigation = useNavigation<any>();
  const { ads, createAd, setAdActive, deleteAd, activeProperty } = useAdmin();

  const [note, setNote] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 6)); // default: 7 days
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const days = daysShown(endDate);

  const handleDateChange = (_e: any, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) setEndDate(selected);
  };

  const validate = (): string | null => {
    if (!note.trim() && !imageUri) return 'Write a note or add a photo for the ad.';
    if (days < 1) return 'The end date cannot be in the past.';
    return null;
  };

  const handlePublish = async () => {
    if (saving) return; // blocks double taps
    const problem = validate();
    if (problem) {
      Alert.alert('Cannot Publish', problem);
      return;
    }
    setSaving(true);
    const res = await createAd({ note, imageUri, expiresOn: endDate });
    setSaving(false);
    if (!res.ok) {
      // the form stays filled, so nothing is lost
      Alert.alert('Could Not Publish', res.message ?? 'Please try again.');
      return;
    }
    setNote('');
    setImageUri(null);
    setEndDate(addDays(new Date(), 6));
    Alert.alert('Ad Published', `Residents will see it for the next ${days} day${days > 1 ? 's' : ''}.`);
  };

  const handlePreview = () => {
    if (!note.trim() && !imageUri) {
      Alert.alert('Nothing to Preview', 'Write a note or add a photo first.');
      return;
    }
    setPreviewVisible(true);
  };

  const confirmDelete = (ad: AdminAd) => {
    Alert.alert('Delete Ad', 'Residents will no longer see this ad. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAd(ad.id) },
    ]);
  };

  const renderAd = (ad: AdminAd) => {
    const expired = Date.now() > ad.expiresAt;
    const live = isAdLiveNow(ad);
    const left = Math.max(0, Math.ceil((ad.expiresAt - Date.now()) / DAY_MS));
    const badge = expired
      ? { label: 'Expired', bg: '#FEE2E2', fg: colors.error }
      : !ad.active
      ? { label: 'Paused', bg: '#FEF3C7', fg: colors.warning }
      : { label: 'Live', bg: '#D1FAE5', fg: colors.success };

    return (
      <View key={ad.id} style={styles.adCard}>
        <View style={{ flexDirection: 'row' }}>
          {ad.imageUrl ? (
            <Image source={{ uri: ad.imageUrl }} style={styles.adThumb} />
          ) : (
            <View style={[styles.adThumb, styles.adThumbEmpty]}>
              <Ionicons name="megaphone-outline" size={22} color={colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[typography.caption, { color: badge.fg, fontWeight: '700' }]}>{badge.label}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmDelete(ad)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.body, { color: colors.text, marginTop: 4 }]} numberOfLines={2}>
              {ad.note || 'Photo ad'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {expired
                ? `Ended ${formatDate(new Date(ad.expiresAt))}`
                : `Until ${formatDate(new Date(ad.expiresAt))} · ${left} day${left !== 1 ? 's' : ''} left`}
            </Text>
          </View>
        </View>
        {!expired && (
          <View style={styles.pauseRow}>
            <Text style={[typography.caption, { color: colors.text }]}>{live ? 'Showing to residents' : 'Paused'}</Text>
            <Switch
              value={ad.active}
              onValueChange={(v) => setAdActive(ad.id, v)}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={colors.white}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Ads</Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* ---------------- New ad ---------------- */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="megaphone" size={18} color={colors.warning} />
              <Text style={[typography.bodyBold, { color: colors.text, marginLeft: spacing.xs, letterSpacing: 0.5 }]}>
                NEW ADVERTISEMENT
              </Text>
            </View>
            {!!activeProperty && (
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                Shown to residents of {activeProperty.name} when they log in.
              </Text>
            )}

            {/* Photo */}
            <Text style={[typography.caption, styles.label]}>Photo (optional)</Text>
            {imageUri ? (
              <View style={{ marginBottom: spacing.md }}>
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                <TouchableOpacity style={styles.removeBadge} onPress={() => setImageUri(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtonRow}>
                <TouchableOpacity style={[styles.photoButton, styles.photoButtonOutline]} activeOpacity={0.85} onPress={() => pickImageFromFiles(setImageUri)}>
                  <Ionicons name="images-outline" size={18} color={colors.warning} />
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '700', marginLeft: 6 }]}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoButton, styles.photoButtonFilled]} activeOpacity={0.85} onPress={() => takePhotoWithCamera(setImageUri)}>
                  <Ionicons name="camera" size={18} color={colors.white} />
                  <Text style={[typography.caption, { color: colors.white, fontWeight: '700', marginLeft: 6 }]}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Note + calendar side by side */}
            <View style={styles.noteRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, styles.label]}>Note</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. 10% off on advance rent this month!"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={MAX_NOTE}
                  textAlignVertical="top"
                />
                <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'right', marginTop: 4 }]}>
                  {note.length}/{MAX_NOTE}
                </Text>
              </View>

              <View style={styles.calendarCol}>
                <Text style={[typography.caption, styles.label]}>Show until</Text>
                <TouchableOpacity style={styles.calendarTile} activeOpacity={0.8} onPress={() => setShowPicker(true)}>
                  <Ionicons name="calendar" size={22} color={colors.warning} />
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '700', marginTop: 4, textAlign: 'center' }]}>
                    {formatDate(endDate)}
                  </Text>
                  <Text style={[typography.caption, { color: days < 1 ? colors.error : colors.success, fontWeight: '700', marginTop: 2 }]}>
                    {days < 1 ? 'Past date' : `${days} day${days > 1 ? 's' : ''}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            )}

            <View style={styles.chipRow}>
              {QUICK_DAYS.map((n) => {
                const active = days === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setEndDate(addDays(new Date(), n - 1))}
                  >
                    <Text style={[typography.caption, { color: active ? colors.white : colors.text, fontWeight: '700' }]}>{n} days</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={handlePreview} disabled={saving}>
                <Ionicons name="eye-outline" size={18} color={colors.text} />
                <Text style={[typography.button, { color: colors.text, marginLeft: spacing.xs }]}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} activeOpacity={0.85} onPress={handlePublish} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color={colors.white} />
                    <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Publish Ad</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ---------------- Existing ads ---------------- */}
          <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>Your Ads ({ads.length})</Text>
          {ads.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>No ads yet. Publish one above and residents will see it when they log in.</Text>
          ) : (
            ads.map(renderAd)
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AdPopupModal
        visible={previewVisible}
        ads={[{ id: 'preview', note, imageUrl: imageUri }]}
        onClose={() => setPreviewVisible(false)}
      />
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
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
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
  noteInput: { minHeight: 120 },
  noteRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  calendarCol: { width: 104 },
  calendarTile: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    minHeight: 120,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  photoButtonRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  photoButtonOutline: { borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.background },
  photoButtonFilled: { backgroundColor: colors.primary },
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.background },
  removeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  adThumb: { width: 64, height: 64, borderRadius: radius.sm },
  adThumbEmpty: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});