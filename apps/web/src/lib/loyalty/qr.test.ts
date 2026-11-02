import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { qrMatrix } from './qr';

describe('qrMatrix', () => {
  it('keeps card links at QR version 4 or lower, with a 4-module quiet zone (ADR-002)', () => {
    // Production origin plus the 22-char token: 43 characters → version 4 at error correction M.
    const link = 'https://cavella.pl/c#AAECAwQFBgcICQoLDA0ODw';
    const { version } = encode(link, { ecc: 'M' });
    const qr = qrMatrix(link);

    expect(version).toBeLessThanOrEqual(4);
    expect(qr.size).toBe(17 + 4 * version + 2 * 4);
    expect(qr.modules[0]?.every((dark) => !dark)).toBe(true); // quiet-zone row is light
    expect(qr.modules[4]?.[4]).toBe(true); // finder-pattern corner is dark
  });

  it('draws exactly the dark modules', () => {
    const qr = qrMatrix('hello');
    const dark = qr.modules.flat().filter(Boolean).length;
    const drawn = [...qr.path.matchAll(/h(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(drawn).toBe(dark);
  });
});
