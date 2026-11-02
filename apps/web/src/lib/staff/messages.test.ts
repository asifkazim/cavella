import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/i18n';
import { failureMessage } from './messages';

describe('failureMessage', () => {
  for (const locale of ['pl', 'en'] as const) {
    const t = getDictionary(locale).staff;

    it(`[${locale}] never claims a write failed when the outcome is unknown (H2, E-01)`, () => {
      // A network error includes a timeout after the request was sent: the server may have committed.
      expect(failureMessage({ kind: 'network' }, t)).toBe(t.errors.unknownOutcome);
      expect(failureMessage({ kind: 'server' }, t)).toBe(t.errors.unknownOutcome);
    });

    it(`[${locale}] an action interrupted by session expiry asks to finish it`, () => {
      expect(failureMessage({ kind: 'interrupted' }, t)).toBe(t.errors.interrupted);
    });

    it(`[${locale}] a failed lookup writes nothing, so it does not talk about saving`, () => {
      expect(failureMessage({ kind: 'network' }, t, 'lookup')).toBe(t.errors.offline);
      expect(failureMessage({ kind: 'server' }, t, 'lookup')).toBe(t.errors.generic);
    });
  }
});
