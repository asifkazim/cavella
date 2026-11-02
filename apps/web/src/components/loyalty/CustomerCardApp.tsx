'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '@/content/types';
import { useCustomerCard } from '@/hooks/useCustomerCard';
import { getDictionary, interpolate, type Dictionary } from '@/i18n';
import { intlLocale } from '@/lib/format';
import { BUSINESS_TIME_ZONE } from '@/lib/hours';
import { cardLink, formatCardCode } from '@/lib/loyalty/card-token';
import { CardQr } from './CardQr';
import { SaveCardPanel } from './SaveCardPanel';
import { StampMeter } from './StampMeter';

const primaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-[24px] bg-caramel-400 px-[22px] py-2 font-semibold text-espresso-950 hover:bg-caramel-300 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-[24px] border border-espresso-900/25 px-[22px] py-2 font-semibold text-espresso-900 hover:border-espresso-900 disabled:opacity-60';

function Notice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl p-4 ${tone === 'error' ? 'bg-rose-100 text-rose-950' : 'bg-cream-200/80 text-ink'}`}
    >
      {children}
    </div>
  );
}

/**
 * Removing the card deletes the only copy on this device (E-06), so it takes two steps.
 * Focus moves to the safe choice when the confirmation opens.
 */
function RemoveCard({ onRemove, t }: { onRemove: () => void; t: Dictionary['loyalty'] }) {
  const [confirming, setConfirming] = useState(false);
  const keepButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) keepButton.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={secondaryButton} onClick={() => setConfirming(true)}>{t.removeCard}</button>
      </div>
    );
  }
  return (
    <div className="mt-4" data-testid="confirm-remove">
      <p className="font-semibold">{t.confirmRemoveText}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" ref={keepButton} className={secondaryButton} onClick={() => setConfirming(false)}>{t.keepCard}</button>
        <button type="button" className={secondaryButton} onClick={onRemove}>{t.confirmRemove}</button>
      </div>
    </div>
  );
}

/** The customer's loyalty card (PRD J2, J3, J8). No login; the card lives on this device. */
export function CustomerCardApp({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).loyalty;
  const {
    card, balance, balanceAt, issue, createIssue, busy, storageBlocked, switchCandidate,
    create, refresh, forget, acceptSwitch, rejectSwitch,
  } = useCustomerCard();

  if (card === undefined) {
    return <p className="py-16 text-center text-muted" role="status">{t.loading}</p>;
  }

  if (card === null) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5 sm:p-8">
          <p className="text-lg leading-relaxed">{t.intro}</p>
          <ol className="mt-5 space-y-3">
            {t.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-espresso-900 text-sm font-semibold text-cream-50">
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={`${primaryButton} mt-6 w-full sm:w-auto`}
            disabled={busy === 'creating'}
            onClick={() => void create()}
          >
            {busy === 'creating' ? t.creating : t.getCard}
          </button>
          {createIssue ? (
            <div className="mt-4">
              <Notice tone="error">
                {createIssue === 'rateLimited' ? t.rateLimited : t.createFailed}
              </Notice>
            </div>
          ) : null}
        </section>
        <section className="rounded-(--radius-card) bg-cream-200/60 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">{t.haveCardTitle}</h2>
          <p className="mt-2 leading-relaxed">{t.haveCardText}</p>
          <h2 className="mt-6 font-display text-2xl font-semibold">{t.recoveryTitle}</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
            {t.recoverySteps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </section>
      </div>
    );
  }

  const link = cardLink(window.location.origin, card.token);
  const updated = balanceAt
    ? new Intl.DateTimeFormat(intlLocale(locale), { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TIME_ZONE }).format(new Date(balanceAt))
    : null;

  return (
    <div className="space-y-8">
      {switchCandidate ? (
        <section role="alertdialog" aria-labelledby="switch-title" aria-describedby="switch-text" className="rounded-(--radius-card) bg-caramel-300/30 p-6 ring-1 ring-caramel-500/40">
          <h2 id="switch-title" className="font-display text-2xl font-semibold">{t.switchTitle}</h2>
          <p id="switch-text" className="mt-2">{t.switchText}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={primaryButton} onClick={acceptSwitch}>{t.switchConfirm}</button>
            <button type="button" className={secondaryButton} onClick={rejectSwitch}>{t.switchCancel}</button>
          </div>
        </section>
      ) : null}

      {storageBlocked ? <Notice tone="error">{t.storageBlocked}</Notice> : null}

      {issue === 'notFound' ? (
        <section role="alert" className="rounded-(--radius-card) bg-rose-100 p-6 text-rose-950">
          <h2 className="font-display text-2xl font-semibold">{t.notFoundTitle}</h2>
          <p className="mt-2">{t.notFoundText}</p>
          <RemoveCard onRemove={forget} t={t} />
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <section aria-labelledby="qr-title" className="rounded-(--radius-card) bg-espresso-900 p-5 text-cream-50 sm:p-6">
          <h2 id="qr-title" className="text-center font-display text-xl font-semibold">{t.showAtCounter}</h2>
          {/* ≥ 45 mm on a typical phone (ADR-002). */}
          <div className="mx-auto mt-4 w-full max-w-[20rem] min-w-[12rem]">
            <CardQr value={link} label={t.qrLabel} />
          </div>
          <p className="mt-4 text-center text-sm text-cream-200">{t.cardCode}</p>
          <p className="text-center font-mono text-lg tracking-wider break-all" data-testid="card-code">
            {formatCardCode(card.token)}
          </p>
          <p className="mt-1 text-center text-xs text-cream-200">{t.cardCodeHint}</p>
        </section>

        <section className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5 sm:p-8" aria-live="polite">
          {balance ? (
            <StampMeter balance={balance} t={t} />
          ) : (
            <p className="text-muted">{issue === 'offline' ? t.offlineNoData : t.loading}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
            {updated ? <span>{interpolate(t.updatedAt, { time: updated })}</span> : null}
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-espresso-900 underline underline-offset-4 disabled:no-underline"
              disabled={busy === 'refreshing'}
              onClick={() => void refresh()}
            >
              {busy === 'refreshing' ? t.refreshing : t.refresh}
            </button>
          </div>
          {issue === 'offline' && balance ? (
            <div className="mt-4">
              <Notice tone="info">
                {t.offline}{' '}
                <button type="button" className="font-semibold underline underline-offset-4" onClick={() => void refresh()}>
                  {t.retry}
                </button>
              </Notice>
            </div>
          ) : null}
          {issue === 'rateLimited' ? <div className="mt-4"><Notice tone="info">{t.rateLimited}</Notice></div> : null}
          {issue === 'generic' ? (
            <div className="mt-4">
              <Notice tone="error">
                {t.loadFailed}{' '}
                <button type="button" className="font-semibold underline underline-offset-4" onClick={() => void refresh()}>
                  {t.retry}
                </button>
              </Notice>
            </div>
          ) : null}
        </section>
      </div>

      <SaveCardPanel token={card.token} link={link} t={t} />

      <section aria-labelledby="recovery-title" className="rounded-(--radius-card) bg-cream-200/60 p-6 sm:p-8">
        <h2 id="recovery-title" className="font-display text-2xl font-semibold">{t.recoveryTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
          {t.recoverySteps.map((step) => <li key={step}>{step}</li>)}
        </ul>
      </section>
    </div>
  );
}
