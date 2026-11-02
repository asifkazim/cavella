import { apiRequest } from './client';

/** Balance as returned by the public card endpoints. */
export interface CardBalance {
  readonly stampProgress: number;
  readonly stampsPerReward: number;
  readonly rewardsAvailable: number;
}

export interface IssuedCard {
  readonly token: string;
  readonly card: CardBalance;
}

/** POST /api/v1/cards — no login, no cookies. The token is returned exactly once. */
export async function createCard(): Promise<IssuedCard> {
  return (await apiRequest<IssuedCard>('/api/v1/cards', { method: 'POST', credentials: 'omit' })).data;
}

/** GET /api/v1/cards/self — the token travels only in the X-Card-Token header. */
export async function fetchCard(token: string): Promise<CardBalance> {
  return (
    await apiRequest<CardBalance>('/api/v1/cards/self', {
      credentials: 'omit',
      headers: { 'X-Card-Token': token },
    })
  ).data;
}
