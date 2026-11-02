import type { Dictionary } from '@/i18n';
import type { ActionFailure } from './action-machine';

/** Stable API error codes → staff-facing text (ARCHITECTURE §5.3). */
export function failureMessage(failure: ActionFailure, t: Dictionary['staff']): string {
  switch (failure.kind) {
    case 'network':
      return t.errors.network;
    case 'server':
      return t.errors.server;
    case 'session':
      return t.errors.session;
    case 'csrf':
      return t.errors.csrf;
    case 'rateLimited':
      return t.errors.rateLimited;
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
