import { randomBytes, randomUUID } from 'node:crypto';
import type { Page, Route } from '@playwright/test';

/**
 * In-browser fake of the Cavella API (ARCHITECTURE §5) for UI journeys: same paths, status
 * codes, problem `code`s, CSRF and idempotency semantics, plus fault injection. The real
 * backend contracts are covered by the API's own integration tests.
 */
export const API_ORIGIN = 'http://localhost:8080';

export interface FakeCard {
  id: string;
  token: string;
  status: 'ACTIVE' | 'BLOCKED';
  stampProgress: number;
  rewardsAvailable: number;
  lastEventAt: string | null;
}

export interface LoggedRequest {
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

/**
 * 'network': the request never reaches the server. 'lostResponse': the server processes and
 * commits it, but the answer never reaches the client (timeout, dropped connection). A number:
 * the server answers with that HTTP status.
 */
type FaultKind = 'network' | 'lostResponse' | number;
type Fault = { path: RegExp; method: string; kind: FaultKind; remaining: number };

export const STAFF_EMAIL = 'anna@cavella.test';
export const STAFF_PASSWORD = 'correct horse battery staple';
/** A second cashier, for flows where who signs in matters. */
export const OTHER_STAFF_EMAIL = 'piotr@cavella.test';
const ACCOUNTS: Record<string, string> = { [STAFF_EMAIL]: 'staff-anna', [OTHER_STAFF_EMAIL]: 'staff-piotr' };
const STAMPS_PER_REWARD = 6;
const MAX_PER_TX = 3;

export function newToken(): string {
  return randomBytes(16).toString('base64url');
}

export class FakeApi {
  readonly cards: FakeCard[] = [];
  readonly requests: LoggedRequest[] = [];
  signedIn = false;
  csrfToken = 'csrf-anonymous';
  private faults: Fault[] = [];
  /** Who the session belongs to (set on login). */
  staffId = 'staff-anna';
  /** Stored outcomes per (staff, idempotency key), like the real idempotency_record table. */
  private outcomes = new Map<string, { status: number; body: unknown; replayable: boolean }>();

  async install(page: Page): Promise<void> {
    await page.route(`${API_ORIGIN}/**`, (route) => this.handle(route));
  }

  addCard(partial: Partial<FakeCard> = {}): FakeCard {
    const card: FakeCard = {
      id: randomUUID(),
      token: newToken(),
      status: 'ACTIVE',
      stampProgress: 0,
      rewardsAvailable: 0,
      lastEventAt: null,
      ...partial,
    };
    this.cards.push(card);
    return card;
  }

  /** The next `times` matching requests fail with a network error or the given HTTP status. */
  fail(method: string, path: RegExp, kind: FaultKind, times = 1): void {
    this.faults.push({ method, path, kind, remaining: times });
  }

  requestsTo(method: string, path: RegExp): LoggedRequest[] {
    return this.requests.filter((r) => r.method === method && path.test(r.path));
  }

  private balance(card: FakeCard) {
    return { stampProgress: card.stampProgress, stampsPerReward: STAMPS_PER_REWARD, rewardsAvailable: card.rewardsAvailable };
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = request.headers();
    const cors = {
      'Access-Control-Allow-Origin': headers.origin ?? '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, X-Card-Token, X-CSRF-Token, Idempotency-Key',
      'Access-Control-Expose-Headers': 'Idempotent-Replayed, Retry-After, X-Request-Id',
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    this.requests.push({ method, path: url.pathname, url: request.url(), headers, body: request.postData() });

    const fault = this.faults.find((f) => f.method === method && f.path.test(url.pathname) && f.remaining > 0);
    let loseResponse = false;
    if (fault) {
      fault.remaining--;
      if (fault.kind === 'network') return route.abort('internetdisconnected');
      if (fault.kind === 'lostResponse') loseResponse = true;
      else return json(fault.kind, { code: fault.kind >= 500 ? 'INTERNAL_ERROR' : `HTTP_${fault.kind}` });
    }

    function json(status: number, body: unknown, extra: Record<string, string> = {}) {
      // The request was fully processed above; only the answer is lost on the way back.
      if (loseResponse) return route.abort('connectionreset');
      return route.fulfill({
        status,
        headers: { ...cors, 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...extra },
        body: JSON.stringify(body),
      });
    }
    const problem = (status: number, code: string) => json(status, { status, code, title: code });
    const body = (): Record<string, unknown> => JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
    const path = url.pathname;

    // ---- public card endpoints -----------------------------------------------------------
    if (method === 'POST' && path === '/api/v1/cards') {
      const card = this.addCard();
      return json(201, { token: card.token, card: this.balance(card) });
    }
    if (method === 'GET' && path === '/api/v1/cards/self') {
      const card = this.cards.find((c) => c.token === headers['x-card-token']);
      return card ? json(200, this.balance(card)) : problem(404, 'CARD_NOT_FOUND');
    }

    // ---- staff auth ----------------------------------------------------------------------
    if (method === 'GET' && path === '/api/v1/staff/auth/csrf') {
      return json(200, { headerName: 'X-CSRF-Token', token: this.csrfToken });
    }
    if (method === 'POST' && path === '/api/v1/staff/auth/login') {
      if (headers['x-csrf-token'] !== this.csrfToken) return problem(403, 'CSRF_INVALID');
      const { email, password } = body();
      const account = typeof email === 'string' ? ACCOUNTS[email] : undefined;
      if (!account || password !== STAFF_PASSWORD) return problem(401, 'INVALID_CREDENTIALS');
      this.signedIn = true;
      this.staffId = account;
      this.csrfToken = 'csrf-session-1'; // rotates on login
      return json(200, { staff: { id: this.staffId, role: 'CASHIER' }, csrfToken: this.csrfToken });
    }
    if (method === 'GET' && path === '/api/v1/staff/me') {
      return this.signedIn ? json(200, { id: this.staffId, role: 'CASHIER' }) : problem(401, 'UNAUTHENTICATED');
    }

    // ---- staff endpoints: session + CSRF -------------------------------------------------
    if (path.startsWith('/api/v1/staff/')) {
      if (!this.signedIn) return problem(401, 'UNAUTHENTICATED');
      if (method === 'POST' && headers['x-csrf-token'] !== this.csrfToken) return problem(403, 'CSRF_INVALID');
    }
    if (method === 'POST' && path === '/api/v1/staff/auth/logout') {
      this.signedIn = false;
      return route.fulfill({ status: 204, headers: cors });
    }
    if (method === 'POST' && path === '/api/v1/staff/cards/lookup') {
      const card = this.cards.find((c) => c.token === body().token);
      if (!card) return problem(404, 'CARD_NOT_FOUND');
      return json(200, { cardId: card.id, status: card.status, balance: this.balance(card), lastEventAt: card.lastEventAt });
    }

    const action = /^\/api\/v1\/staff\/cards\/([^/]+)\/(stamps|redemptions)$/.exec(path);
    if (method === 'POST' && action) {
      const key = headers['idempotency-key'];
      if (!key) return problem(400, 'IDEMPOTENCY_KEY_REQUIRED');
      const scopedKey = `${this.staffId}|${key}`;
      const stored = this.outcomes.get(scopedKey);
      if (stored) {
        return stored.replayable ? json(stored.status, stored.body, { 'Idempotent-Replayed': 'true' }) : json(stored.status, stored.body);
      }
      const card = this.cards.find((c) => c.id === action[1]);
      const remember = (status: number, responseBody: unknown, replayable: boolean) => {
        this.outcomes.set(scopedKey, { status, body: responseBody, replayable });
        return json(status, responseBody);
      };
      if (!card) return remember(404, { status: 404, code: 'CARD_NOT_FOUND' }, false);
      if (card.status === 'BLOCKED') return remember(409, { status: 409, code: 'CARD_BLOCKED' }, false);

      if (action[2] === 'stamps') {
        const quantity = Number(body().quantity);
        if (!Number.isInteger(quantity) || quantity < 1) return problem(400, 'VALIDATION_FAILED');
        if (quantity > MAX_PER_TX) return problem(422, 'QUANTITY_EXCEEDS_CAP');
        const total = card.stampProgress + quantity;
        const earned = Math.floor(total / STAMPS_PER_REWARD);
        card.stampProgress = total % STAMPS_PER_REWARD;
        card.rewardsAvailable += earned;
        card.lastEventAt = new Date().toISOString();
        return remember(201, { eventId: randomUUID(), balance: this.balance(card), rewardsEarned: earned }, true);
      }
      if (card.rewardsAvailable === 0) return remember(409, { status: 409, code: 'NO_REWARD_AVAILABLE' }, false);
      card.rewardsAvailable -= 1;
      card.lastEventAt = new Date().toISOString();
      return remember(201, { eventId: randomUUID(), balance: this.balance(card) }, true);
    }

    return problem(404, 'NOT_FOUND');
  }
}
