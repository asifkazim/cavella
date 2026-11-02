'use client';

import { useReducer, useRef, useState } from 'react';
import type { Locale } from '@/content/types';
import type { Dictionary } from '@/i18n';
import { interpolate } from '@/i18n';
import { addStamps, redeemReward, type CardSummary } from '@/lib/api/staff';
import { intlLocale } from '@/lib/format';
import { BUSINESS_TIME_ZONE } from '@/lib/hours';
import { actionReducer, canSubmit, IDLE, isRetryable, type ActionKind } from '@/lib/staff/action-machine';
import { toFailure } from '@/lib/staff/failures';
import { failureMessage } from '@/lib/staff/messages';

/** Mirrors the server's per-transaction cap (PRD FR-S-06); the server enforces it regardless. */
export const MAX_STAMPS_PER_TRANSACTION = 3;

interface CardActionsPanelProps {
  readonly summary: CardSummary;
  readonly csrfToken: string;
  readonly locale: Locale;
  readonly t: Dictionary['staff'];
  readonly onSessionExpired: () => void;
  readonly onCsrfInvalid: () => Promise<void>;
  readonly onNext: () => void;
}

const primary =
  'inline-flex min-h-12 items-center justify-center rounded-[24px] bg-caramel-400 px-[22px] py-2 font-semibold text-espresso-950 hover:bg-caramel-300 disabled:cursor-not-allowed disabled:opacity-50';
const secondary =
  'inline-flex min-h-12 items-center justify-center rounded-[24px] border border-espresso-900/25 px-[22px] py-2 font-semibold hover:border-espresso-900 disabled:cursor-not-allowed disabled:opacity-50';

/** Card summary plus the two cashier actions, each behind an explicit confirm (PRD J4, J5). */
export function CardActionsPanel({
  summary: initial, csrfToken, locale, t, onSessionExpired, onCsrfInvalid, onNext,
}: CardActionsPanelProps) {
  const [summary, setSummary] = useState(initial);
  const [quantity, setQuantity] = useState(1);
  const [action, dispatch] = useReducer(actionReducer, IDLE);
  /** Blocks a second request even before React re-renders (double tap within one frame). */
  const inFlight = useRef(false);

  const { balance, status } = summary;
  const blocked = status === 'BLOCKED';
  const busy = action.status === 'submitting';

  function prepare(kind: ActionKind, qty: number) {
    dispatch({ type: 'prepare', kind, quantity: qty, idempotencyKey: crypto.randomUUID() });
  }

  function changeQuantity(next: number) {
    const clamped = Math.min(MAX_STAMPS_PER_TRANSACTION, Math.max(1, next));
    setQuantity(clamped);
    if (action.status === 'confirming' && action.action.kind === 'stamp') prepare('stamp', clamped); // new intent, new key
  }

  async function submit() {
    if (inFlight.current || !canSubmit(action) || action.status === 'idle' || action.status === 'succeeded') return;
    inFlight.current = true;
    const { kind, quantity: qty, idempotencyKey } = action.action;
    dispatch({ type: 'submit' });
    try {
      if (kind === 'stamp') {
        const { result, replayed } = await addStamps(summary.cardId, qty, idempotencyKey, csrfToken);
        setSummary((s) => ({ ...s, balance: result.balance, lastEventAt: new Date().toISOString() }));
        dispatch({ type: 'succeed', replayed, rewardsEarned: result.rewardsEarned });
      } else {
        const { result, replayed } = await redeemReward(summary.cardId, idempotencyKey, csrfToken);
        setSummary((s) => ({ ...s, balance: result.balance, lastEventAt: new Date().toISOString() }));
        dispatch({ type: 'succeed', replayed, rewardsEarned: 0 });
      }
    } catch (error) {
      const failure = toFailure(error);
      if (failure.kind === 'session') {
        onSessionExpired();
        return;
      }
      if (failure.kind === 'csrf') await onCsrfInvalid();
      dispatch({ type: 'fail', failure });
    } finally {
      inFlight.current = false;
    }
  }

  const lastVisit = summary.lastEventAt
    ? interpolate(t.lastVisit, {
        time: new Intl.DateTimeFormat(intlLocale(locale), {
          dateStyle: 'short', timeStyle: 'short', timeZone: BUSINESS_TIME_ZONE,
        }).format(new Date(summary.lastEventAt)),
      })
    : t.newCardBadge;

  return (
    <section aria-labelledby="card-panel-title" className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="card-panel-title" className="font-display text-2xl font-semibold">{t.cardTitle}</h2>
        <span className="text-sm text-muted">{lastVisit}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3" data-testid="staff-balance">
        <div className="rounded-2xl bg-cream-200/70 p-4">
          <dt className="text-sm text-muted">{t.stampsLabel}</dt>
          <dd className="font-display text-3xl font-semibold">
            {balance.stampProgress}<span className="text-lg text-muted"> / {balance.stampsPerReward}</span>
          </dd>
        </div>
        <div className={`rounded-2xl p-4 ${balance.rewardsAvailable > 0 ? 'bg-espresso-900 text-cream-50' : 'bg-cream-200/70'}`}>
          <dt className="text-sm opacity-80">{t.rewardsLabel}</dt>
          <dd className="font-display text-3xl font-semibold">{balance.rewardsAvailable}</dd>
        </div>
      </dl>

      {blocked ? <p role="alert" className="mt-4 rounded-xl bg-rose-100 p-3 text-rose-950">{t.blocked}</p> : null}

      {!blocked ? (
        <div className="mt-6 space-y-6">
          {/* Add stamps */}
          <div>
            <p className="font-semibold" id="qty-label">{t.quantityLabel}</p>
            <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="qty-label">
              <button type="button" className={`${secondary} w-12 px-0 text-xl`} aria-label={t.decrease} disabled={busy || quantity <= 1} onClick={() => changeQuantity(quantity - 1)}>−</button>
              <output aria-live="polite" className="w-10 text-center font-display text-3xl font-semibold">{quantity}</output>
              <button type="button" className={`${secondary} w-12 px-0 text-xl`} aria-label={t.increase} disabled={busy || quantity >= MAX_STAMPS_PER_TRANSACTION} onClick={() => changeQuantity(quantity + 1)}>+</button>
            </div>
            {action.status === 'confirming' && action.action.kind === 'stamp' ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className={primary} onClick={() => void submit()}>
                  {interpolate(t.confirmStamps, { count: String(action.action.quantity) })}
                </button>
                <button type="button" className={secondary} onClick={() => dispatch({ type: 'reset' })}>{t.cancel}</button>
              </div>
            ) : (
              <button type="button" className={`${primary} mt-3`} disabled={busy} onClick={() => prepare('stamp', quantity)}>
                {busy && action.action.kind === 'stamp' ? t.submitting : t.addStamps}
              </button>
            )}
          </div>

          {/* Redeem */}
          <div className="border-t border-espresso-900/10 pt-6">
            {action.status === 'confirming' && action.action.kind === 'redeem' ? (
              <div role="alertdialog" aria-labelledby="redeem-confirm-title" className="rounded-2xl bg-caramel-300/30 p-4">
                <p id="redeem-confirm-title" className="font-semibold">{t.confirmRedeemTitle}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" className={primary} onClick={() => void submit()}>{t.confirmRedeem}</button>
                  <button type="button" className={secondary} onClick={() => dispatch({ type: 'reset' })}>{t.cancel}</button>
                </div>
              </div>
            ) : (
              <button type="button" className={secondary} disabled={busy || balance.rewardsAvailable === 0} onClick={() => prepare('redeem', 1)}>
                {busy && action.action.kind === 'redeem' ? t.submitting : t.redeem}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Feedback */}
      <div className="mt-6 min-h-6">
        {action.status === 'succeeded' ? (
          <div role="status" className="rounded-xl bg-emerald-100 p-4 text-emerald-950" data-testid="action-success">
            <p className="font-semibold">
              ✓ {action.action.kind === 'stamp' ? interpolate(t.stampSuccess, { count: String(action.action.quantity) }) : t.redeemSuccess}
            </p>
            {action.rewardsEarned > 0 ? <p className="mt-1 font-display text-xl">{t.rewardEarned}</p> : null}
            {action.replayed ? <p className="mt-1 text-sm">{t.alreadyRecorded}</p> : null}
          </div>
        ) : null}
        {action.status === 'failed' ? (
          <div role="alert" className="rounded-xl bg-rose-100 p-4 text-rose-950" data-testid="action-error">
            <p className="font-semibold">{failureMessage(action.failure, t)}</p>
            {isRetryable(action.failure) ? (
              <button type="button" className={`${secondary} mt-3`} onClick={() => void submit()}>{t.retry}</button>
            ) : null}
          </div>
        ) : null}
      </div>

      <button type="button" className={`${secondary} mt-6 w-full`} disabled={busy} onClick={onNext}>{t.nextCard}</button>
    </section>
  );
}
