import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

// Per-device app settings, saved in a small JSON file (same approach as the notice read-state).
export type AppSettings = {
  rentReminders: boolean;
  // Minutes of inactivity before the user is signed out. 0 = never.
  autoLogoutMinutes: number;
};

const DEFAULTS: AppSettings = { rentReminders: true, autoLogoutMinutes: 0 };
const FILE = `${FileSystem.documentDirectory}app-settings.json`;

let current: AppSettings = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<(s: AppSettings) => void>();

const emit = () => listeners.forEach((l) => l(current));

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(FILE);
      current = { ...DEFAULTS, ...JSON.parse(raw) };
      emit();
    }
  } catch (e) {
    console.warn('settings load:', e);
  }
}

export function updateSettings(patch: Partial<AppSettings>) {
  current = { ...current, ...patch };
  emit();
  FileSystem.writeAsStringAsync(FILE, JSON.stringify(current)).catch((e) => console.warn('settings save:', e));
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(current);
  useEffect(() => {
    listeners.add(setSettings);
    load();
    setSettings(current);
    return () => {
      listeners.delete(setSettings);
    };
  }, []);
  return { settings, update: updateSettings };
}