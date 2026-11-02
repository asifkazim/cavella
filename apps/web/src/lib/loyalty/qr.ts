import { encode } from 'uqr';

export interface QrMatrix {
  /** Modules per side, including the quiet zone. */
  readonly size: number;
  /** SVG path drawing every dark module (one rectangle per horizontal run). */
  readonly path: string;
  readonly modules: readonly (readonly boolean[])[];
}

/** Quiet zone of 4 modules, as the QR spec requires for reliable scanning (ADR-002). */
const QUIET_ZONE = 4;

/** Encodes text with error-correction level M (ADR-002: version 3 for a card link). */
export function qrMatrix(text: string): QrMatrix {
  const { data } = encode(text, { ecc: 'M', border: QUIET_ZONE });
  const parts: string[] = [];
  data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  });
  return { size: data.length, path: parts.join(''), modules: data };
}
