import { useMemo } from 'react';
import { qrMatrix } from '@/lib/loyalty/qr';

/**
 * The card's QR code as crisp SVG: always black on white with a quiet zone, whatever the page
 * theme, so phone cameras and scanners read it reliably (ADR-002).
 */
export function CardQr({ value, label }: { value: string; label: string }) {
  const qr = useMemo(() => qrMatrix(value), [value]);
  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="block h-auto w-full rounded-xl bg-white"
      data-testid="card-qr"
    >
      <rect width={qr.size} height={qr.size} fill="#ffffff" />
      <path d={qr.path} fill="#000000" />
    </svg>
  );
}
