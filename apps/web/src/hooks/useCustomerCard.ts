'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createCard, fetchCard, type CardBalance } from '@/lib/api/customer';
import { cardIssueOf, type CardIssue } from '@/lib/loyalty/card-issue';
import {
  parseStoredCard,
  readPendingToken,
  readStoredCardRaw,
  removeCard,
  saveCard,
  setPendingToken,
  subscribeToCardStorage,
  type StoredCard,
} from '@/lib/loyalty/card-storage';

export type CreateIssue = 'offline' | 'rateLimited' | 'generic';

const REFRESH_INTERVAL_MS = 15_000; // well inside the API's 60 reads/minute per client

/** Card creation has no "not found": anything that isn't offline or rate-limited is generic. */
function createIssueOf(error: unknown): CreateIssue {
  const issue = cardIssueOf(error);
  return issue === 'offline' || issue === 'rateLimited' ? issue : 'generic';
}

const noServerSnapshot = (): undefined => undefined;
const noPendingOnServer = (): null => null;

/**
 * The customer's card: stored on this device, refreshed from the API while the page is visible
 * (PRD FR-L-04), with the last known balance kept for offline display (NFR-P-05).
 */
export function useCustomerCard() {
  // `undefined` while prerendering/hydrating: the device's storage is not known yet.
  const raw = useSyncExternalStore(subscribeToCardStorage, readStoredCardRaw, noServerSnapshot);
  const pending = useSyncExternalStore(subscribeToCardStorage, readPendingToken, noPendingOnServer);
  /** Used only when the browser refuses to store the card (private mode). */
  const [memoryCard, setMemoryCard] = useState<StoredCard | null>(null);
  const [issue, setIssue] = useState<CardIssue | null>(null);
  const [createIssue, setCreateIssue] = useState<CreateIssue | null>(null);
  const [busy, setBusy] = useState<'creating' | 'refreshing' | null>(null);

  const stored = useMemo(() => (raw === undefined ? undefined : parseStoredCard(raw)), [raw]);
  // A card opened from a link while storage is blocked lives in session storage as "pending".
  const pendingOnly = stored === null && pending !== null ? { token: pending, balance: null, balanceAt: null } : null;
  const card: StoredCard | null | undefined = stored === undefined ? undefined : (stored ?? memoryCard ?? pendingOnly);
  const storageBlocked = card != null && stored === null;
  const switchCandidate = stored && pending && pending !== stored.token ? pending : null;
  const token = card?.token ?? null;

  const keep = useCallback((next: StoredCard) => {
    if (!saveCard(next)) setMemoryCard(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setBusy('refreshing');
    try {
      const balance = await fetchCard(token);
      keep({ token, balance, balanceAt: new Date().toISOString() });
      setIssue(null);
    } catch (error) {
      setIssue(cardIssueOf(error));
    } finally {
      setBusy(null);
    }
  }, [token, keep]);

  useEffect(() => {
    if (!token) return undefined;
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    refreshIfVisible();
    const timer = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, [token, refresh]);

  const create = useCallback(async () => {
    setBusy('creating');
    setCreateIssue(null);
    try {
      const issued = await createCard();
      keep({ token: issued.token, balance: issued.card, balanceAt: new Date().toISOString() });
      setIssue(null);
    } catch (error) {
      setCreateIssue(createIssueOf(error));
    } finally {
      setBusy(null);
    }
  }, [keep]);

  const forget = useCallback(() => {
    removeCard();
    setPendingToken(null);
    setMemoryCard(null);
    setIssue(null);
  }, []);

  const acceptSwitch = useCallback(() => {
    if (!switchCandidate) return;
    keep({ token: switchCandidate, balance: null, balanceAt: null });
    setPendingToken(null);
    setIssue(null);
  }, [switchCandidate, keep]);

  const rejectSwitch = useCallback(() => setPendingToken(null), []);

  const balance: CardBalance | null = card?.balance ?? null;
  return {
    /** undefined = still reading this device's storage. */
    card,
    balance,
    balanceAt: card?.balanceAt ?? null,
    issue,
    createIssue,
    busy,
    storageBlocked,
    switchCandidate,
    create,
    refresh,
    forget,
    acceptSwitch,
    rejectSwitch,
  };
}
