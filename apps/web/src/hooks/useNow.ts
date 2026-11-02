'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 15_000;

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, TICK_MS);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onChange);
  };
}

// Rounded so the snapshot is stable between renders within one tick.
const getSnapshot = (): number => Math.floor(Date.now() / TICK_MS) * TICK_MS;
// Static HTML is built ahead of time, so the server never knows "now".
const getServerSnapshot = (): null => null;

/**
 * Current time, refreshed every 15 s and when the tab becomes visible.
 * Returns `null` during prerender/hydration so components can show a loading state
 * instead of a wrong, build-time status.
 */
export function useNow(): Date | null {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return timestamp === null ? null : new Date(timestamp);
}
