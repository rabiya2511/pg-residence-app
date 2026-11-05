import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';
import { useAppSettings } from '../../utils/appSettings';

const LOCK_AFTER_MS = 30 * 1000; // lock again after this long in the background

// Asks for fingerprint / face / device PIN when the app opens and after it was in the background.
export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const { role, logout } = useMockAuth();
  const { settings, loaded } = useAppSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const leftAt = useRef<number | null>(null);

  const enabled = !!role && settings.biometricLock;

  const unlock = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setFailed(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Lokansh Aditya PG',
        cancelLabel: 'Cancel',
        // The phone's PIN / pattern is accepted too, so a failed fingerprint never locks the person out.
        disableDeviceFallback: false,
      });
      if (result.success) setUnlocked(true);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
    }
  }, []);

  // Locked again after logout, so the next session starts locked.
  useEffect(() => {
    if (!role) setUnlocked(false);
  }, [role]);

  // Ask as soon as the lock is needed (app start with a saved session).
  useEffect(() => {
    if (loaded && enabled && !unlocked) unlock();
  }, [loaded, enabled, unlocked, unlock]);

  // Lock again after a while in the background.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt.current = Date.now();
      if (s === 'active' && leftAt.current) {
        if (Date.now() - leftAt.current > LOCK_AFTER_MS) setUnlocked(false);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Hide the content while the settings load (a moment) and while locked.
  const covered = !!role && (!loaded || (settings.biometricLock && !unlocked));

  return (
    <View style={{ flex: 1 }}>
      {children}
      {covered && (
        <View style={styles.cover}>
          {loaded && (
            <>
              <Ionicons name="lock-closed" size={44} color={colors.primary} />
              <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.md }]}>App locked</Text>
              <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
                {failed ? 'Could not unlock. Try again.' : 'Use your fingerprint, face or phone PIN to continue.'}
              </Text>
              <TouchableOpacity style={styles.unlockBtn} activeOpacity={0.85} onPress={unlock}>
                <Ionicons name="finger-print" size={20} color={colors.white} />
                <Text style={[typography.button, { color: colors.white, marginLeft: spacing.xs }]}>Unlock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: spacing.lg }} onPress={() => logout()}>
                <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>Log out instead</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
});