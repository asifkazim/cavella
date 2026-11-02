import { describe, expect, it } from 'vitest';
import { resumeFor, type PendingAction } from './pending-action';

const pending: PendingAction = {
  staffId: 'staff-anna',
  cardId: 'card-1',
  action: { kind: 'stamp', quantity: 2, idempotencyKey: 'k1' },
};

describe('resumeFor (L5: an action interrupted by session expiry)', () => {
  it('resumes the same action, with the same key, for the same cashier and card', () => {
    expect(resumeFor(pending, 'staff-anna', 'card-1')).toEqual(pending.action);
  });

  it('never resumes for another staff member: their key scope differs, a replay would apply it twice', () => {
    expect(resumeFor(pending, 'staff-piotr', 'card-1')).toBeNull();
  });

  it('never resumes on another card, or when nothing is pending', () => {
    expect(resumeFor(pending, 'staff-anna', 'card-2')).toBeNull();
    expect(resumeFor(null, 'staff-anna', 'card-1')).toBeNull();
  });
});
