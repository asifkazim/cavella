'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n';
import { renderCardImage } from '@/lib/loyalty/card-image';
import { formatCardCode } from '@/lib/loyalty/card-token';
import { qrMatrix } from '@/lib/loyalty/qr';

interface SaveCardPanelProps {
  readonly token: string;
  readonly link: string;
  readonly t: Dictionary['loyalty'];
}

const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-[24px] border border-espresso-900/25 px-[22px] py-2 font-semibold text-espresso-900 hover:border-espresso-900 hover:bg-espresso-900/5';

/**
 * Practical backups for a card that otherwise exists only in this browser (ADR-002 recovery):
 * an image of the QR code, the share sheet, or the clipboard. Everything is generated on the
 * device; nothing is uploaded.
 */
export function SaveCardPanel({ token, link, t }: SaveCardPanelProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function saveImage() {
    const blob = await renderCardImage(qrMatrix(link), { title: t.imageTitle, code: formatCardCode(token) });
    const file = new File([blob], t.imageFileName, { type: 'image/png' });
    // Phones: the share sheet offers "Save image" / Photos. Desktop: a normal download.
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t.imageTitle });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = t.imageFileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareLink() {
    try {
      await navigator.share({ title: t.imageTitle, url: link });
    } catch {
      // Cancelled by the user: nothing to report.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback(t.copied);
    } catch {
      setFeedback(t.copyFailed);
    }
  }

  return (
    <section aria-labelledby="save-card-title" className="rounded-(--radius-card) bg-cream-50 p-6 ring-1 ring-espresso-900/5 sm:p-8">
      <h2 id="save-card-title" className="font-display text-2xl font-semibold">
        {t.saveTitle}
      </h2>
      <p className="mt-2 leading-relaxed text-muted">{t.saveIntro}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={() => void saveImage()} className={buttonClass}>
          {t.saveImage}
        </button>
        {canShare ? (
          <button type="button" onClick={() => void shareLink()} className={buttonClass}>
            {t.shareLink}
          </button>
        ) : null}
        <button type="button" onClick={() => void copyLink()} className={buttonClass}>
          {t.copyLink}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{t.saveImageHint}</p>
      <p role="status" className="mt-2 min-h-6 text-sm font-semibold">
        {feedback}
      </p>
      <p className="mt-1 rounded-xl bg-caramel-300/25 p-3 text-sm">{t.linkWarning}</p>
    </section>
  );
}
