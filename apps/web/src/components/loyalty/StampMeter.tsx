import type { CardBalance } from '@/lib/api/customer';
import type { Dictionary } from '@/i18n';
import { interpolate } from '@/i18n';

/**
 * Stamp progress as a row of cups plus text. The text carries the meaning; the cups are
 * decorative (NFR-A-05: never only a graphic).
 */
export function StampMeter({ balance, t }: { balance: CardBalance; t: Dictionary['loyalty'] }) {
  const { stampProgress, stampsPerReward, rewardsAvailable } = balance;
  const toGo = stampsPerReward - stampProgress;
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">{t.stampsLabel}</h2>
      <ol aria-hidden="true" className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: stampsPerReward }, (_, i) => (
          <li
            key={i}
            className={`flex size-10 items-center justify-center rounded-full border-2 text-lg font-semibold ${
              i < stampProgress
                ? 'border-caramel-500 bg-caramel-400 text-espresso-950'
                : 'border-dashed border-espresso-900/25 text-espresso-900/30'
            }`}
          >
            {i < stampProgress ? '✓' : i + 1}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-lg font-semibold" data-testid="stamp-count">
        {interpolate(t.stampsCount, { count: String(stampProgress), total: String(stampsPerReward) })}
      </p>
      <p className="text-muted">{interpolate(t.stampsToGo, { count: String(toGo) })}</p>
      {rewardsAvailable > 0 ? (
        <p
          className="mt-4 rounded-2xl bg-espresso-900 px-4 py-3 text-cream-50"
          data-testid="rewards-ready"
        >
          <strong className="block font-display text-xl">
            {interpolate(t.rewardsReady, { count: String(rewardsAvailable) })}
          </strong>
          <span className="text-sm text-cream-200">{t.rewardsReadyHint}</span>
        </p>
      ) : null}
    </div>
  );
}
