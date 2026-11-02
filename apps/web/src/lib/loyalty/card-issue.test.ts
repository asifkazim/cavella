import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api/client';
import { cardIssueOf } from './card-issue';

describe('cardIssueOf', () => {
  it('reports a missing card only when the API says so with its stable code', () => {
    expect(cardIssueOf(new ApiError(404, 'CARD_NOT_FOUND', null))).toBe('notFound');
  });

  it('never treats other 404s as a missing card (M4: wrong API URL, proxy or maintenance page)', () => {
    // problemCode() yields HTTP_404 for non-problem bodies such as an HTML error page.
    expect(cardIssueOf(new ApiError(404, 'HTTP_404', null))).toBe('generic');
    expect(cardIssueOf(new ApiError(404, 'NOT_FOUND', null))).toBe('generic');
  });

  it('classifies connection problems, rate limits and everything else', () => {
    expect(cardIssueOf(new NetworkError())).toBe('offline');
    expect(cardIssueOf(new ApiError(429, 'RATE_LIMITED', 30))).toBe('rateLimited');
    expect(cardIssueOf(new ApiError(500, 'INTERNAL_ERROR', null))).toBe('generic');
    expect(cardIssueOf(new Error('boom'))).toBe('generic');
  });
});
