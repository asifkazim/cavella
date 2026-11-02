'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { fetchCsrfToken, fetchCurrentStaff, logIn, logOut, type StaffMember } from '@/lib/api/staff';

export type StaffSessionState =
  | { readonly status: 'checking' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'signedOut'; readonly expired: boolean }
  | { readonly status: 'signedIn'; readonly staff: StaffMember; readonly csrfToken: string };

export type LoginFailure =
  | { readonly kind: 'invalidCredentials' }
  | { readonly kind: 'locked'; readonly minutes: number }
  | { readonly kind: 'rateLimited' }
  | { readonly kind: 'network' };

/**
 * Staff session backed by the server-side session cookie (ARCHITECTURE §7). The CSRF token is
 * kept in memory only, and re-fetched from the server after a reload.
 */
/** Asks the server whether this browser has a staff session. */
async function loadSession(): Promise<StaffSessionState> {
  try {
    const staff = await fetchCurrentStaff();
    const csrfToken = await fetchCsrfToken();
    return { status: 'signedIn', staff, csrfToken };
  } catch (error) {
    return error instanceof ApiError && error.status === 401
      ? { status: 'signedOut', expired: false }
      : { status: 'unreachable' };
  }
}

export function useStaffSession() {
  const [state, setState] = useState<StaffSessionState>({ status: 'checking' });

  useEffect(() => {
    let active = true;
    void loadSession().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const check = useCallback(async () => {
    setState({ status: 'checking' });
    setState(await loadSession());
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginFailure | null> => {
    try {
      const anonymousCsrf = await fetchCsrfToken();
      const { staff, csrfToken } = await logIn(email, password, anonymousCsrf);
      setState({ status: 'signedIn', staff, csrfToken });
      return null;
    } catch (error) {
      if (!(error instanceof ApiError)) return { kind: 'network' };
      if (error.code === 'ACCOUNT_LOCKED') {
        return { kind: 'locked', minutes: Math.max(1, Math.ceil((error.retryAfterSeconds ?? 900) / 60)) };
      }
      if (error.status === 429) return { kind: 'rateLimited' };
      return { kind: 'invalidCredentials' };
    }
  }, []);

  const logout = useCallback(async () => {
    if (state.status === 'signedIn') {
      try {
        await logOut(state.csrfToken);
      } catch {
        // Even if the server is unreachable, forget the session locally.
      }
    }
    setState({ status: 'signedOut', expired: false });
  }, [state]);

  const expire = useCallback(() => setState({ status: 'signedOut', expired: true }), []);

  /** Re-fetches the session's CSRF token after a CSRF_INVALID answer. */
  const refreshCsrf = useCallback(async () => {
    try {
      const csrfToken = await fetchCsrfToken();
      setState((current) => (current.status === 'signedIn' ? { ...current, csrfToken } : current));
    } catch {
      // The next action will report the problem.
    }
  }, []);

  return { state, retry: check, login, logout, expire, refreshCsrf };
}
