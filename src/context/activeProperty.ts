import { useSyncExternalStore } from 'react';

// Tiny shared store that remembers which property ("branch") the admin has
// selected as Active. No provider is needed — any screen can call
// useActivePropertyId() and will re-render when the selection changes.
// It lives in memory only; if the saved id no longer exists (e.g. the property
// was deleted, or a different admin logged in) resolveActiveProperty() falls
// back to the first property automatically.

let activeId: string | null = null;
const listeners = new Set<() => void>();

export function setActivePropertyId(id: string | null) {
  if (id === activeId) return;
  activeId = id;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => activeId;

export function useActivePropertyId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function resolveActiveProperty<T extends { id: string }>(
  properties: T[],
  id: string | null
): T | undefined {
  return properties.find((p) => p.id === id) ?? properties[0];
}