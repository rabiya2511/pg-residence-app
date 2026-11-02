import { useCallback, useEffect, useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

// Which notices this resident has already opened. Kept in a small file on the phone
// (per resident), shared by every screen so the Home bell badge and the lists agree.
let owner: string | null = null;
let ids = new Set<string>();
let snapshot: ReadonlySet<string> = ids;
const listeners = new Set<() => void>();

const emit = () => {
  snapshot = new Set(ids);
  listeners.forEach((l) => l());
};
const pathFor = (o: string) => `${FileSystem.documentDirectory ?? ''}read-notices-${o}.json`;

async function load(o: string) {
  try {
    const p = pathFor(o);
    const info = await FileSystem.getInfoAsync(p);
    const loaded: string[] = info.exists ? JSON.parse(await FileSystem.readAsStringAsync(p)) : [];
    if (owner === o) {
      ids = new Set([...loaded, ...ids]);
      emit();
    }
  } catch {
    /* unreadable file: start with nothing read */
  }
}

async function save() {
  if (!owner) return;
  try {
    await FileSystem.writeAsStringAsync(pathFor(owner), JSON.stringify([...ids]));
  } catch {
    /* in-memory state still works for this session */
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useNoticeReads(residentId: string | null) {
  useEffect(() => {
    if (owner !== residentId) {
      owner = residentId;
      ids = new Set();
      emit();
      if (residentId) load(residentId);
    }
  }, [residentId]);

  const read = useSyncExternalStore(subscribe, () => snapshot);

  const markRead = useCallback((id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    emit();
    save();
  }, []);

  const markAllRead = useCallback((all: string[]) => {
    all.forEach((i) => ids.add(i));
    emit();
    save();
  }, []);

  const isRead = useCallback((id: string) => read.has(id), [read]);

  return { isRead, markRead, markAllRead };
}