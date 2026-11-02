import { ApiError, NetworkError } from '@/lib/api/client';

/** Why the latest balance could not be fetched. The card itself stays usable in every case. */
export type CardIssue = 'offline' | 'notFound' | 'rateLimited' | 'generic';

/**
 * Classifies a failed card read. Only the API's own `CARD_NOT_FOUND` means the card is gone:
 * a bare 404 can come from a wrong API URL, a proxy or a maintenance page, and treating it as
 * "card not found" would invite the customer to delete the only copy of a valid card (M4).
 */
export function cardIssueOf(error: unknown): CardIssue {
  if (error instanceof NetworkError) return 'offline';
  if (error instanceof ApiError && error.code === 'CARD_NOT_FOUND') return 'notFound';
  if (error instanceof ApiError && error.status === 429) return 'rateLimited';
  return 'generic';
}
