import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

// Per-device app settings, saved in a small JSON file (same approach as the notice read-state).
export type AppSettings = {
  rentReminders: boolean;
  // Minutes of inactivity before the user is signed out. 0 = never.
  autoLogoutMinutes: number;
  // Ask for fingerprint / face / phone PIN when the app opens or comes back after a while.
  biometricLock: boolean;
};

const DEFAULTS: AppSettings = { rentReminders: true, autoLogoutMinutes: 0, biometricLock: false };
const FILE = `${FileSystem.documentDirectory}app-settings.json`;

let current: AppSettings = { ...DEFAULTS };
let started = false; // loading has begun
let ready = false; // the saved file has been read (or there was none)
let pending: Partial<AppSettings> = {}; // changes made before the file finished loading
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

async function load() {
  if (started) return;
  started = true;
  let saved: Partial<AppSettings> = {};
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(FILE);
      saved = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('settings load:', e);
  } finally {
    current = { ...DEFAULTS, ...saved, ...pending };
    pending = {};
    ready = true;
    emit();
  }
}

export function updateSettings(patch: Partial<AppSettings>) {
  if (!ready) pending = { ...pending, ...patch };
  current = { ...current, ...patch };
  emit();
  FileSystem.writeAsStringAsync(FILE, JSON.stringify(current)).catch((e) => console.warn('settings save:', e));
}

export function useAppSettings() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { settings: current, loaded: ready, update: updateSettings, updateSettings };
}