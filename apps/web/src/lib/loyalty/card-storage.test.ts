import { describe, expect, it } from 'vitest';
import { parseStoredCard, serialiseStoredCard } from './card-storage';

const TOKEN = 'AAECAwQFBgcICQoLDA0ODw';

describe('stored card parsing', () => {
  it('round-trips a card with its last known balance', () => {
    const card = {
      token: TOKEN,
      balance: { stampProgress: 4, stampsPerReward: 6, rewardsAvailable: 1 },
      balanceAt: '2026-11-02T08:00:00.000Z',
    };
    expect(parseStoredCard(serialiseStoredCard(card))).toEqual(card);
  });

  it('treats missing, corrupt or tampered data as "no card"', () => {
    expect(parseStoredCard(null)).toBeNull();
    expect(parseStoredCard('not json')).toBeNull();
    expect(parseStoredCard('{"token":"short"}')).toBeNull();
    expect(parseStoredCard('[1,2,3]')).toBeNull();
  });

  it('keeps the token but drops an invalid cached balance', () => {
    const raw = JSON.stringify({ token: TOKEN, balance: { stampProgress: -1 }, balanceAt: 5 });
    expect(parseStoredCard(raw)).toEqual({ token: TOKEN, balance: null, balanceAt: null });
  });
});
