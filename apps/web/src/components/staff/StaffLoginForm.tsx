'use client';

import { useId, useState, type FormEvent } from 'react';
import type { LoginFailure } from '@/hooks/useStaffSession';
import type { Dictionary } from '@/i18n';
import { interpolate } from '@/i18n';

interface StaffLoginFormProps {
  readonly onLogin: (email: string, password: string) => Promise<LoginFailure | null>;
  readonly expired: boolean;
  readonly t: Dictionary['staff'];
}

export function StaffLoginForm({ onLogin, expired, t }: StaffLoginFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<LoginFailure | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await onLogin(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
    setPending(false);
    setFailure(result);
  }

  const message = !failure
    ? null
    : failure.kind === 'invalidCredentials'
      ? t.errors.invalidCredentials
      : failure.kind === 'locked'
        ? interpolate(t.errors.accountLocked, { minutes: String(failure.minutes) })
        : failure.kind === 'rateLimited'
          ? t.errors.rateLimited
          : t.errors.network;

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-md rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold">{t.loginTitle}</h2>
      {expired ? <p role="status" className="mt-3 rounded-xl bg-caramel-300/30 p-3">{t.errors.session}</p> : null}
      <label htmlFor={emailId} className="mt-5 block font-semibold">{t.email}</label>
      <input id={emailId} name="email" type="email" autoComplete="username" required className="mt-1 min-h-12 w-full rounded-xl border border-espresso-900/25 bg-white px-4" />
      <label htmlFor={passwordId} className="mt-4 block font-semibold">{t.password}</label>
      <input id={passwordId} name="password" type="password" autoComplete="current-password" required className="mt-1 min-h-12 w-full rounded-xl border border-espresso-900/25 bg-white px-4" />
      {message ? <p role="alert" className="mt-4 rounded-xl bg-rose-100 p-3 text-rose-950">{message}</p> : null}
      <button type="submit" disabled={pending} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[24px] bg-caramel-400 px-[22px] font-semibold text-espresso-950 hover:bg-caramel-300 disabled:opacity-60">
        {pending ? t.signingIn : t.signIn}
      </button>
    </form>
  );
}
