import type { Dictionary } from '@/i18n';
import type { ActionFailure } from './action-machine';

/**
 * Stable API error codes → staff-facing text (ARCHITECTURE §5.3).
 *
 * `context` matters for network and server failures: a failed write may still have been
 * committed (the answer was lost or timed out), so it must never be reported as "not saved"
 * (PRD E-01). A lookup writes nothing, so it gets a plain connection message.
 */
export function failureMessage(
  failure: ActionFailure,
  t: Dictionary['staff'],
  context: 'action' | 'lookup' = 'action',
): string {
  switch (failure.kind) {
    case 'network':
      return context === 'lookup' ? t.errors.offline : t.errors.unknownOutcome;
    case 'server':
      return context === 'lookup' ? t.errors.generic : t.errors.unknownOutcome;
    case 'session':
      return t.errors.session;
    case 'csrf':
      return t.errors.csrf;
    case 'rateLimited':
      return t.errors.rateLimited;
    case 'interrupted':
      return t.errors.interrupted;
    case 'rejected':
      switch (failure.code) {
        case 'NO_REWARD_AVAILABLE':
          return t.errors.noReward;
        case 'CARD_NOT_FOUND':
          return t.errors.cardNotFound;
        case 'CARD_BLOCKED':
          return t.errors.cardBlocked;
        case 'QUANTITY_EXCEEDS_CAP':
          return t.errors.quantityCap;
        case 'IDEMPOTENCY_KEY_REUSED':
          return t.errors.keyReused;
        case 'FORBIDDEN':
          return t.errors.forbidden;
        default:
          return t.errors.generic;
      }
  }
}
