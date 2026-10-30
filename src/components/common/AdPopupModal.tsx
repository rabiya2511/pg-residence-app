import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isAdLiveNow } from '../../context/AdminContext';

export type PopupAd = { id: string; note: string; imageUrl: string | null };

/**
 * The pop-up card. Used by the resident dashboard (real ads) and by the
 * admin "Preview" button (the draft ad).
 */
export default function AdPopupModal({
  visible,
  ads,
  onClose,
}: {
  visible: boolean;
  ads: PopupAd[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const ad = ads[Math.min(index, ads.length - 1)];
  if (!ad) return null;

  const isLast = index >= ads.length - 1;
  const showImage = !!ad.imageUrl && !failed[ad.id];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={colors.white} />
          </TouchableOpacity>

          {showImage && (
            <Image
              source={{ uri: ad.imageUrl as string }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setFailed((prev) => ({ ...prev, [ad.id]: true }))}
            />
          )}

          {!!ad.note.trim() && (
            <ScrollView style={styles.noteScroll} contentContainerStyle={{ padding: spacing.md }}>
              <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>{ad.note}</Text>
            </ScrollView>
          )}

          <View style={styles.footer}>
            {ads.length > 1 && (
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                {index + 1} of {ads.length}
              </Text>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={() => (isLast ? onClose() : setIndex((i) => i + 1))}
            >
              <Text style={[typography.button, { color: colors.white }]}>{isLast ? 'Got it' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ───────── Resident side ─────────
// Ads already shown during this login. Cleared on logout via resetAdPopupSession().
const seenAdIds = new Set<string>();

/** Call this when the resident logs out, so the pop-up shows again at the next login. */
export function resetAdPopupSession() {
  seenAdIds.clear();
}

/**
 * Drop <ResidentAdPopup /> anywhere inside the resident dashboard screen.
 * It opens by itself, once per login, for every live ad of the resident's property.
 */
export function ResidentAdPopup() {
  const { ads } = useAdmin();
  const [, setTick] = useState(0);

  // When the resident logs out the dashboard unmounts, so the next login shows the ads again.
  useEffect(() => () => resetAdPopupSession(), []);

  const pending: PopupAd[] = ads
    .filter((a) => isAdLiveNow(a) && !seenAdIds.has(a.id))
    .map((a) => ({ id: a.id, note: a.note, imageUrl: a.imageUrl }));

  return (
    <AdPopupModal
      visible={pending.length > 0}
      ads={pending}
      onClose={() => {
        pending.forEach((a) => seenAdIds.add(a.id));
        setTick((t) => t + 1);
      }}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: 260, backgroundColor: colors.background },
  noteScroll: { maxHeight: 180 },
  footer: { padding: spacing.md, paddingTop: spacing.sm, alignItems: 'center' },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});