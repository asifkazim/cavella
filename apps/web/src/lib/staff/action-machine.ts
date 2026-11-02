/**
 * State machine for a cashier action (add stamps / redeem), shared by the staff UI.
 *
 * Guarantees (PRD E-01, E-02, BR-06):
 * - One idempotency key per confirmed intent; changing the intent (e.g. the quantity) makes a new key.
 * - A second submit while one is in flight is ignored.
 * - A retry after a network/server failure reuses the same key, so the server deduplicates it if
 *   the first attempt actually committed.
 * - After a business rejection the key is spent: trying again requires preparing a new intent.
 */

export type ActionKind = 'stamp' | 'redeem';

export interface PreparedAction {
  readonly kind: ActionKind;
  readonly quantity: number;
  readonly idempotencyKey: string;
}

export type ActionFailure =
  | { readonly kind: 'network' }
  | { readonly kind: 'server' }
  | { readonly kind: 'session' }
  | { readonly kind: 'csrf' }
  | { readonly kind: 'rateLimited' }
  | { readonly kind: 'rejected'; readonly code: string };

export type ActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'confirming'; readonly action: PreparedAction }
  | { readonly status: 'submitting'; readonly action: PreparedAction }
  | {
      readonly status: 'succeeded';
      readonly action: PreparedAction;
      readonly replayed: boolean;
      readonly rewardsEarned: number;
    }
  | { readonly status: 'failed'; readonly action: PreparedAction; readonly failure: ActionFailure };

export type ActionEvent =
  | { readonly type: 'prepare'; readonly kind: ActionKind; readonly quantity: number; readonly idempotencyKey: string }
  | { readonly type: 'submit' }
  | { readonly type: 'succeed'; readonly replayed: boolean; readonly rewardsEarned: number }
  | { readonly type: 'fail'; readonly failure: ActionFailure }
  | { readonly type: 'reset' };

export const IDLE: ActionState = { status: 'idle' };

/** Failures where the server state is unknown or the request never ran: retry with the same key. */
export function isRetryable(failure: ActionFailure): boolean {
  return failure.kind === 'network' || failure.kind === 'server' || failure.kind === 'csrf' || failure.kind === 'rateLimited';
}

export function canSubmit(state: ActionState): boolean {
  return state.status === 'confirming' || (state.status === 'failed' && isRetryable(state.failure));
}

export function actionReducer(state: ActionState, event: ActionEvent): ActionState {
  switch (event.type) {
    case 'prepare':
      // Never replace an action that is already on its way to the server.
      if (state.status === 'submitting') return state;
      return {
        status: 'confirming',
        action: { kind: event.kind, quantity: event.quantity, idempotencyKey: event.idempotencyKey },
      };
    case 'submit':
      if (state.status === 'confirming' || (state.status === 'failed' && isRetryable(state.failure))) {
        return { status: 'submitting', action: state.action };
      }
      return state;
    case 'succeed':
      return state.status === 'submitting'
        ? { status: 'succeeded', action: state.action, replayed: event.replayed, rewardsEarned: event.rewardsEarned }
        : state;
    case 'fail':
      return state.status === 'submitting' ? { status: 'failed', action: state.action, failure: event.failure } : state;
    case 'reset':
      return state.status === 'submitting' ? state : IDLE;
  }
}
