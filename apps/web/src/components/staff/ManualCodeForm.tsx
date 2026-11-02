'use client';

import { useId, useState, type FormEvent } from 'react';
import type { Dictionary } from '@/i18n';
import { isCardToken, normaliseCardCode } from '@/lib/loyalty/card-token';

/** Fallback when the QR code cannot be scanned (PRD J7): staff type the code shown under it. */
export function ManualCodeForm({ onToken, t }: { onToken: (token: string) => void; t: Dictionary['staff'] }) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const token = normaliseCardCode(value);
    if (!isCardToken(token)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setValue('');
    onToken(token);
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="block font-semibold">
        {t.manualLabel}
      </label>
      <p id={hintId} className="text-sm text-muted">
        {t.manualHint}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
          aria-invalid={invalid}
          className="min-h-12 w-full min-w-0 rounded-xl border border-espresso-900/25 bg-white px-4 font-mono text-lg tracking-wider"
        />
        <button type="submit" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[24px] bg-espresso-900 px-[22px] font-semibold text-cream-50 hover:bg-espresso-800">
          {t.manualSubmit}
        </button>
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-semibold text-rose-800">
          {t.invalidCode}
        </p>
      ) : null}
    </form>
  );
}
