import React, { useEffect, useRef, ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { useMockAuth } from '../../context/MockAuthContext';
import { useAppSettings } from '../../utils/appSettings';

// Signs the user out after the chosen period of inactivity.
// Counts touches while the app is open, and the time spent in the background.
export default function InactivityGuard({ children }: { children: ReactNode }) {
  const { role, logout } = useMockAuth();
  const { settings } = useAppSettings();
  const lastActive = useRef(Date.now());
  const limitMs = settings.autoLogoutMinutes * 60 * 1000;
  const enabled = !!role && limitMs > 0;

  const check = () => {
    if (enabled && Date.now() - lastActive.current > limitMs) {
      lastActive.current = Date.now();
      logout();
    }
  };

  // Reset the clock whenever the setting or the login state changes.
  useEffect(() => {
    lastActive.current = Date.now();
  }, [enabled, limitMs]);

  // Check every 20 seconds while the app is open.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [enabled, limitMs]);

  // Check straight away when the app comes back from the background.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [enabled, limitMs]);

  return (
    <View style={{ flex: 1 }} onTouchStart={() => (lastActive.current = Date.now())}>
      {children}
    </View>
  );
}