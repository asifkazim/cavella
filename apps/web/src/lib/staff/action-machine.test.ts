import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api/client';
import { actionReducer, canSubmit, IDLE, type ActionState } from './action-machine';
import { toFailure } from './failures';

const prepare = (key: string, quantity = 1) =>
  ({ type: 'prepare', kind: 'stamp', quantity, idempotencyKey: key }) as const;

function run(...events: Parameters<typeof actionReducer>[1][]): ActionState {
  return events.reduce(actionReducer, IDLE);
}

describe('cashier action state machine', () => {
  it('confirms, submits and succeeds with one key', () => {
    const state = run(prepare('k1'), { type: 'submit' }, { type: 'succeed', replayed: false, rewardsEarned: 1 });
    expect(state).toEqual({
      status: 'succeeded',
      action: { kind: 'stamp', quantity: 1, idempotencyKey: 'k1' },
      replayed: false,
      rewardsEarned: 1,
    });
  });

  it('ignores a second submit while the first is in flight (double tap, E-02)', () => {
    const submitting = run(prepare('k1'), { type: 'submit' });
    expect(actionReducer(submitting, { type: 'submit' })).toBe(submitting);
    expect(canSubmit(submitting)).toBe(false);
  });

  it('cannot change or cancel an action that is already in flight', () => {
    const submitting = run(prepare('k1'), { type: 'submit' });
    expect(actionReducer(submitting, prepare('k2', 2))).toBe(submitting);
    expect(actionReducer(submitting, { type: 'reset' })).toBe(submitting);
  });

  it('a changed quantity is a new intent with a new key', () => {
    const state = run(prepare('k1', 1), prepare('k2', 2));
    expect(state).toEqual({ status: 'confirming', action: { kind: 'stamp', quantity: 2, idempotencyKey: 'k2' } });
  });

  it('retries a network failure with the SAME key (E-01)', () => {
    const failed = run(prepare('k1'), { type: 'submit' }, { type: 'fail', failure: { kind: 'network' } });
    expect(canSubmit(failed)).toBe(true);
    const retry = actionReducer(failed, { type: 'submit' });
    expect(retry).toEqual({ status: 'submitting', action: { kind: 'stamp', quantity: 1, idempotencyKey: 'k1' } });
  });

  it('does not resubmit after a business rejection: a new attempt needs a new key', () => {
    const rejected = run(
      prepare('k1'),
      { type: 'submit' },
      { type: 'fail', failure: { kind: 'rejected', code: 'NO_REWARD_AVAILABLE' } },
    );
    expect(canSubmit(rejected)).toBe(false);
    expect(actionReducer(rejected, { type: 'submit' })).toBe(rejected);
  });

  it('ignores stray results that do not belong to an in-flight action', () => {
    expect(actionReducer(IDLE, { type: 'succeed', replayed: false, rewardsEarned: 0 })).toBe(IDLE);
    expect(actionReducer(IDLE, { type: 'fail', failure: { kind: 'network' } })).toBe(IDLE);
  });
});

describe('toFailure', () => {
  it('classifies API and network errors', () => {
    expect(toFailure(new NetworkError())).toEqual({ kind: 'network' });
    expect(toFailure(new ApiError(401, 'UNAUTHENTICATED', null))).toEqual({ kind: 'session' });
    expect(toFailure(new ApiError(403, 'CSRF_INVALID', null))).toEqual({ kind: 'csrf' });
    expect(toFailure(new ApiError(429, 'RATE_LIMITED', 30))).toEqual({ kind: 'rateLimited' });
    expect(toFailure(new ApiError(503, 'SERVICE_UNAVAILABLE', null))).toEqual({ kind: 'server' });
    expect(toFailure(new ApiError(409, 'NO_REWARD_AVAILABLE', null))).toEqual({
      kind: 'rejected',
      code: 'NO_REWARD_AVAILABLE',
    });
    expect(toFailure(new Error('boom'))).toEqual({ kind: 'server' });
  });
});
