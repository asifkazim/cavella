import { ApiError, NetworkError } from '@/lib/api/client';
import type { ActionFailure } from './action-machine';

/** Maps any error from a staff API call to a UI failure category. */
export function toFailure(error: unknown): ActionFailure {
  if (error instanceof NetworkError) return { kind: 'network' };
  if (error instanceof ApiError) {
    if (error.status === 401) return { kind: 'session' };
    if (error.code === 'CSRF_INVALID') return { kind: 'csrf' };
    if (error.status === 429) return { kind: 'rateLimited' };
    if (error.status >= 500) return { kind: 'server' };
    return { kind: 'rejected', code: error.code };
  }
  return { kind: 'server' };
}
