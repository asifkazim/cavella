import type { CardBalance } from '@/lib/api/customer';
import { isCardToken } from './card-token';

/**
 * The customer's card lives only on their device (ADR-002): the token plus the last known
 * balance for offline display (NFR-P-05). Never sent to analytics or logs.
 */
export interface StoredCard {
  readonly token: string;
  readonly balance: CardBalance | null;
  /** ISO timestamp of the last successful balance fetch. */
  readonly balanceAt: string | null;
}

export const CARD_STORAGE_KEY = 'cavella.card';
/** A card arriving from a QR/link while another card is stored waits here for the customer's choice. */
export const PENDING_CARD_KEY = 'cavella.pendingCard';
const CHANGE_EVENT = 'cavella:card-storage';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isBalance(value: unknown): value is CardBalance {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  return [b.stampProgress, b.stampsPerReward, b.rewardsAvailable].every(
    (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0,
  );
}

/** Parses stored JSON defensively: anything malformed is treated as "no card". */
export function parseStoredCard(raw: string | null): StoredCard | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (!isCardToken(v.token)) return null;
    return {
      token: v.token,
      balance: isBalance(v.balance) ? v.balance : null,
      balanceAt: typeof v.balanceAt === 'string' ? v.balanceAt : null,
    };
  } catch {
    return null;
  }
}

export function serialiseStoredCard(card: StoredCard): string {
  return JSON.stringify(card);
}

/** Storage access can throw (private mode, blocked site data); never let that break the page. */
function safe<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

function local(): KeyValueStore | null {
  return typeof window === 'undefined' ? null : safe(() => window.localStorage, null);
}

function session(): KeyValueStore | null {
  return typeof window === 'undefined' ? null : safe(() => window.sessionStorage, null);
}

function notify(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Raw stored string: stable between calls, as useSyncExternalStore requires. */
export function readStoredCardRaw(): string | null {
  const store = local();
  return store ? safe(() => store.getItem(CARD_STORAGE_KEY), null) : null;
}

/** Returns false when the browser refused to store the card (the caller must warn the customer). */
export function saveCard(card: StoredCard): boolean {
  const store = local();
  const ok = store !== null && safe(() => (store.setItem(CARD_STORAGE_KEY, serialiseStoredCard(card)), true), false);
  notify();
  return ok;
}

export function removeCard(): void {
  const store = local();
  if (store) safe(() => store.removeItem(CARD_STORAGE_KEY), undefined);
  notify();
}

export function readPendingToken(): string | null {
  const store = session();
  const value = store ? safe(() => store.getItem(PENDING_CARD_KEY), null) : null;
  return isCardToken(value) ? value : null;
}

export function setPendingToken(token: string | null): void {
  const store = session();
  if (store) {
    safe(() => (token ? store.setItem(PENDING_CARD_KEY, token) : store.removeItem(PENDING_CARD_KEY)), undefined);
  }
  notify();
}

export function subscribeToCardStorage(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
