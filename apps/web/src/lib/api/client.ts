/**
 * Minimal client for the Cavella API (ARCHITECTURE §5). Errors are normalised into
 * {@link ApiError} (the server answered with an RFC 9457 problem) or {@link NetworkError}
 * (no answer at all), so UI code never parses responses itself.
 *
 * Never put card tokens in paths or query strings: they go in headers only (ADR-002).
 */

/** Set at build time for each environment; the static export bakes it in. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`API error ${status} ${code}`);
    this.name = 'ApiError';
  }
}

/** The request never got an HTTP answer (offline, DNS, CORS, timeout). Nothing is known about server state. */
export class NetworkError extends Error {
  constructor() {
    super('Network error');
    this.name = 'NetworkError';
  }
}

export interface ApiResponse<T> {
  readonly status: number;
  readonly headers: Headers;
  readonly data: T;
}

export interface ApiRequest {
  readonly method?: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** 'include' only for staff calls that rely on the session cookie. */
  readonly credentials: RequestCredentials;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

async function problemCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') {
      return (body as { code: string }).code;
    }
  } catch {
    // Not JSON: fall through to the generic code.
  }
  return `HTTP_${response.status}`;
}

export async function apiRequest<T>(path: string, request: ApiRequest): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: request.method ?? 'GET',
      credentials: request.credentials,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...request.headers,
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await problemCode(response), parseRetryAfter(response.headers.get('Retry-After')));
  }
  const data = (response.status === 204 ? undefined : await response.json()) as T;
  return { status: response.status, headers: response.headers, data };
}
