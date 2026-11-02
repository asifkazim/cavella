import type { PreparedAction } from './action-machine';

/**
 * A cashier action cut off by session expiry (L5). Its outcome may be unknown (the attempt
 * before the 401 may have committed), so it must be finished with the SAME idempotency key.
 */
export interface PendingAction {
  readonly staffId: string;
  readonly cardId: string;
  readonly action: PreparedAction;
}

/**
 * The action to resume after signing in again, or null.
 *
 * Only for the same staff member: keys are scoped per staff user on the server, so the same
 * key under another account is a different intent and would apply the action a second time.
 */
export function resumeFor(pending: PendingAction | null, staffId: string, cardId: string): PreparedAction | null {
  return pending && pending.staffId === staffId && pending.cardId === cardId ? pending.action : null;
}
