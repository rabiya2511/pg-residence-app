import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin, isAdLiveNow } from '../../context/AdminContext';

export type PopupAd = { id: string; note: string; imageUrl: string | null };

/**
 * The pop-up card. Used by the resident dashboard (real ads) and by the
 * admin "Preview" button (the draft ad).
 *
 * The card is a fixed block: 60% of the screen height, about 92% of the width. The WHOLE photo is
 * shown (never cropped); a blurred copy of the photo fills any space around it. The note sits in a
 * strip at the bottom of the card. There is no button: the X (or a tap outside the card) closes
 * it, and with several ads, tapping the card shows the next one.
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
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const ad = ads[Math.min(index, ads.length - 1)];
  if (!ad) return null;

  const hasMore = index < ads.length - 1;
  const showImage = !!ad.imageUrl && !failed[ad.id];
  const note = ad.note.trim();

  const cardW = Math.min(width * 0.92, 520);
  const cardH = height * 0.6;
  const noteH = showImage && note ? Math.min(96, cardH * 0.22) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Tap outside the card to close */}
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Tap the card: next ad (when there is one). Taps here never reach the overlay. */}
        <Pressable
          style={[styles.card, { width: cardW, height: cardH }]}
          onPress={() => hasMore && setIndex((i) => i + 1)}
        >
          {showImage ? (
            <>
              <View style={{ width: cardW, height: cardH - noteH }}>
                {/* Blurred copy fills the whole block */}
                <Image
                  source={{ uri: ad.imageUrl as string }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  blurRadius={25}
                />
                <View style={[StyleSheet.absoluteFill, styles.blurShade]} />
                {/* The whole, sharp photo on top */}
                <Image
                  source={{ uri: ad.imageUrl as string }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                  onError={() => setFailed((prev) => ({ ...prev, [ad.id]: true }))}
                />
              </View>

              {!!note && (
                <View style={[styles.noteStrip, { height: noteH }]}>
                  <ScrollView contentContainerStyle={styles.noteContent} showsVerticalScrollIndicator={false}>
                    <Text style={[typography.body, styles.noteText]}>{note}</Text>
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
            /* Text-only ad (or photo that could not load): large note on a coloured block */
            <View style={styles.textOnly}>
              <ScrollView contentContainerStyle={styles.textOnlyContent} showsVerticalScrollIndicator={false}>
                <Ionicons name="megaphone" size={44} color="rgba(255,255,255,0.9)" />
                <Text style={[typography.heading2, styles.textOnlyNote]}>{note || ' '}</Text>
              </ScrollView>
            </View>
          )}

          {/* Several ads: "1 of 3 · tap for next" */}
          {ads.length > 1 && (
            <View style={styles.counter}>
              <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>
                {index + 1} of {ads.length}
                {hasMore ? ' · tap for next' : ''}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  blurShade: { backgroundColor: 'rgba(0,0,0,0.25)' },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 3,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: spacing.sm + 6,
    left: spacing.sm,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  noteStrip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  noteContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.sm },
  noteText: { color: colors.white, textAlign: 'center', fontSize: 16, lineHeight: 22 },
  textOnly: { flex: 1, backgroundColor: colors.primary },
  textOnlyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  textOnlyNote: { color: colors.white, textAlign: 'center', marginTop: spacing.md },
});