import type { Metadata } from 'next';
import { CardLinkReceiver } from '@/components/loyalty/CardLinkReceiver';
import { getDictionary } from '@/i18n';

/** `/c#<token>`: the URL encoded in every card's QR code (ADR-002). */
export const metadata: Metadata = {
  title: 'Cavella',
  robots: { index: false, follow: false },
  // The fragment never leaves the browser, but keep any future path/query out of referrers too.
  referrer: 'no-referrer',
};

export default function CardLinkPage() {
  const pl = getDictionary('pl');
  return (
    <main className="grid min-h-dvh place-items-center bg-cream-100">
      <CardLinkReceiver message={pl.loyalty.openingLink} />
      <noscript>
        <p className="p-8 text-center">JavaScript is required to open your Cavella card.</p>
      </noscript>
    </main>
  );
}
