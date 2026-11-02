import type { QrMatrix } from './qr';

export interface CardImageText {
  readonly title: string;
  readonly code: string;
}

/**
 * Renders a printable/saveable PNG of the card (QR + card code) entirely on the device — the
 * token never leaves the browser. Browser-only (uses canvas).
 */
export async function renderCardImage(qr: QrMatrix, text: CardImageText): Promise<Blob> {
  const cell = 16;
  const qrSize = qr.size * cell;
  const width = qrSize;
  const height = qrSize + 200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#2b1a12';
  ctx.font = '600 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(text.title, width / 2, 80);

  ctx.fillStyle = '#000000';
  qr.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect(x * cell, 110 + y * cell, cell, cell);
    }),
  );

  ctx.fillStyle = '#2b1a12';
  ctx.font = '32px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(text.code, width / 2, 110 + qrSize + 60);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render image'))), 'image/png'),
  );
}
