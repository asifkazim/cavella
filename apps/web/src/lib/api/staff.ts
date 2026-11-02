import type { CardBalance } from './customer';
import { apiRequest } from './client';

/** Staff endpoints use the session cookie (credentials: 'include') and a CSRF header. */
const CSRF_HEADER = 'X-CSRF-Token';

export interface StaffMember {
  readonly id: string;
  readonly role: 'CASHIER' | 'OWNER';
}

export interface CardSummary {
  readonly cardId: string;
  readonly status: 'PREISSUED' | 'ACTIVE' | 'BLOCKED';
  readonly balance: CardBalance;
  readonly lastEventAt: string | null;
}

export interface StampResult {
  readonly eventId: string;
  readonly balance: CardBalance;
  readonly rewardsEarned: number;
}

export interface RedemptionResult {
  readonly eventId: string;
  readonly balance: CardBalance;
}

/** A mutation result plus whether the server replayed an earlier identical request. */
export interface Recorded<T> {
  readonly result: T;
  readonly replayed: boolean;
}

export async function fetchCsrfToken(): Promise<string> {
  return (await apiRequest<{ token: string }>('/api/v1/staff/auth/csrf', { credentials: 'include' })).data.token;
}

export async function fetchCurrentStaff(): Promise<StaffMember> {
  return (await apiRequest<StaffMember>('/api/v1/staff/me', { credentials: 'include' })).data;
}

/** Returns the staff member and the CSRF token, which rotates on login. */
export async function logIn(
  email: string,
  password: string,
  csrfToken: string,
): Promise<{ staff: StaffMember; csrfToken: string }> {
  return (
    await apiRequest<{ staff: StaffMember; csrfToken: string }>('/api/v1/staff/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: csrfToken },
      body: { email, password },
    })
  ).data;
}

export async function logOut(csrfToken: string): Promise<void> {
  await apiRequest<void>('/api/v1/staff/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { [CSRF_HEADER]: csrfToken },
  });
}

/** The scanned token goes in the request body, never in the URL. */
export async function lookUpCard(token: string, csrfToken: string): Promise<CardSummary> {
  return (
    await apiRequest<CardSummary>('/api/v1/staff/cards/lookup', {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: csrfToken },
      body: { token },
    })
  ).data;
}

export async function addStamps(
  cardId: string,
  quantity: number,
  idempotencyKey: string,
  csrfToken: string,
): Promise<Recorded<StampResult>> {
  const response = await apiRequest<StampResult>(`/api/v1/staff/cards/${encodeURIComponent(cardId)}/stamps`, {
    method: 'POST',
    credentials: 'include',
    headers: { [CSRF_HEADER]: csrfToken, 'Idempotency-Key': idempotencyKey },
    body: { quantity },
  });
  return { result: response.data, replayed: response.headers.get('Idempotent-Replayed') === 'true' };
}

export async function redeemReward(
  cardId: string,
  idempotencyKey: string,
  csrfToken: string,
): Promise<Recorded<RedemptionResult>> {
  const response = await apiRequest<RedemptionResult>(
    `/api/v1/staff/cards/${encodeURIComponent(cardId)}/redemptions`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: csrfToken, 'Idempotency-Key': idempotencyKey },
    },
  );
  return { result: response.data, replayed: response.headers.get('Idempotent-Replayed') === 'true' };
}
