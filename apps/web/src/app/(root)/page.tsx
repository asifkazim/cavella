import type { Metadata } from 'next';
import { defaultLocale, localePath } from '@/i18n/config';

const target = localePath(defaultLocale);

/*
 * Static export has no server redirects. Cloudflare Pages redirects `/` via
 * `public/_redirects`; this page is the fallback (meta refresh + visible links).
 */
export const metadata: Metadata = {
  title: 'Cavella',
  robots: { index: false, follow: true },
};

export default function RootRedirect() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream-100 p-6 text-center">
      {/* React 19 hoists this into <head>. */}
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <p className="text-lg">
        <a className="underline underline-offset-4" href={target}>
          Cavella — przejdź do strony
        </a>
        {' · '}
        <a className="underline underline-offset-4" href={localePath('en')} hrefLang="en">
          Go to the English site
        </a>
      </p>
    </main>
  );
}
