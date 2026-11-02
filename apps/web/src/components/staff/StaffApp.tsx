'use client';

import { useState } from 'react';
import type { Locale } from '@/content/types';
import { useStaffSession } from '@/hooks/useStaffSession';
import { getDictionary, interpolate } from '@/i18n';
import { lookUpCard, type CardSummary } from '@/lib/api/staff';
import type { ActionFailure } from '@/lib/staff/action-machine';
import { toFailure } from '@/lib/staff/failures';
import { failureMessage } from '@/lib/staff/messages';
import { CardActionsPanel } from './CardActionsPanel';
import { ManualCodeForm } from './ManualCodeForm';
import { QrScanner } from './QrScanner';
import { StaffLoginForm } from './StaffLoginForm';

type Lookup =
  | { readonly status: 'scanning' }
  | { readonly status: 'loading' }
  | { readonly status: 'found'; readonly summary: CardSummary; readonly key: number }
  | { readonly status: 'failed'; readonly failure: ActionFailure; readonly token: string };

/** Staff console (PRD J4–J7): protected login, scan or type a card, then confirm actions. */
export function StaffApp({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).staff;
  const { state, retry, login, logout, expire, refreshCsrf } = useStaffSession();
  const [lookup, setLookup] = useState<Lookup>({ status: 'scanning' });
  const csrfToken = state.status === 'signedIn' ? state.csrfToken : null;

  async function findCard(token: string) {
    if (!csrfToken) return;
    setLookup({ status: 'loading' });
    try {
      setLookup({ status: 'found', summary: await lookUpCard(token, csrfToken), key: Date.now() });
    } catch (error) {
      const failure = toFailure(error);
      if (failure.kind === 'session') return expire();
      if (failure.kind === 'csrf') await refreshCsrf();
      setLookup({ status: 'failed', failure, token });
    }
  }

  if (state.status === 'checking') {
    return <p role="status" className="py-16 text-center text-muted">{t.checkingSession}</p>;
  }
  if (state.status === 'unreachable') {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl bg-rose-100 p-6 text-rose-950">
        <p>{t.errors.network}</p>
        <button type="button" onClick={() => void retry()} className="mt-3 inline-flex min-h-12 items-center rounded-[24px] border border-rose-950/30 px-[22px] font-semibold">
          {t.retry}
        </button>
      </div>
    );
  }
  if (state.status === 'signedOut') {
    return <StaffLoginForm onLogin={login} expired={state.expired} t={t} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{interpolate(t.signedInAs, { role: t.roles[state.staff.role] })}</p>
        <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold underline underline-offset-4">
          {t.signOut}
        </button>
      </div>

      {lookup.status === 'found' ? (
        <CardActionsPanel
          key={lookup.key}
          summary={lookup.summary}
          csrfToken={state.csrfToken}
          locale={locale}
          t={t}
          onSessionExpired={expire}
          onCsrfInvalid={refreshCsrf}
          onNext={() => setLookup({ status: 'scanning' })}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="scan-title" className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5">
            <h2 id="scan-title" className="font-display text-2xl font-semibold">{t.scanTitle}</h2>
            <div className="mt-4">
              <QrScanner onToken={(token) => void findCard(token)} t={t} />
            </div>
          </section>
          <section aria-labelledby="manual-title" className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5">
            <h2 id="manual-title" className="font-display text-2xl font-semibold">{t.manualTitle}</h2>
            <div className="mt-4">
              <ManualCodeForm onToken={(token) => void findCard(token)} t={t} />
            </div>
            <div className="mt-4 min-h-6">
              {lookup.status === 'loading' ? <p role="status">{t.lookingUp}</p> : null}
              {lookup.status === 'failed' ? (
                <div role="alert" className="rounded-xl bg-rose-100 p-4 text-rose-950" data-testid="lookup-error">
                  <p className="font-semibold">{failureMessage(lookup.failure, t)}</p>
                  {lookup.failure.kind !== 'rejected' ? (
                    <button type="button" onClick={() => void findCard(lookup.token)} className="mt-2 inline-flex min-h-11 items-center rounded-full font-semibold underline underline-offset-4">
                      {t.retry}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
