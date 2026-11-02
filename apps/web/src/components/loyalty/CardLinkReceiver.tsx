'use client';

import { useEffect } from 'react';
import { isCardToken } from '@/lib/loyalty/card-token';
import { parseStoredCard, readStoredCardRaw, saveCard, setPendingToken } from '@/lib/loyalty/card-storage';

/**
 * Landing point of QR codes and saved links: `/c#<token>` (ADR-002).
 *
 * 1. Takes the token from the fragment (never sent to any server) and immediately removes it
 *    from the address bar and browser history.
 * 2. Stores it on this device — or, if a different card is already stored, parks it so the card
 *    page can ask the customer which one to keep.
 * 3. Opens the card page in the visitor's language.
 */
export function CardLinkReceiver({ message }: { message: string }) {
  useEffect(() => {
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, '', window.location.pathname);

    if (isCardToken(token)) {
      const existing = parseStoredCard(readStoredCardRaw());
      if (existing && existing.token !== token) {
        setPendingToken(token);
      } else if (!existing) {
        if (!saveCard({ token, balance: null, balanceAt: null })) setPendingToken(token);
      }
    }
    const language = navigator.language.toLowerCase();
    const locale = language.startsWith('en') ? 'en' : 'pl';
    window.location.replace(`/${locale}/card/`);
  }, []);

  return (
    <p role="status" className="p-8 text-center">
      {message}
    </p>
  );
}
