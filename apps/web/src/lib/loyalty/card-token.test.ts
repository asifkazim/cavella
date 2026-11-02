import { describe, expect, it } from 'vitest';
import { cardLink, formatCardCode, isCardToken, normaliseCardCode, parseCardPayload } from './card-token';

const TOKEN = 'AAECAwQFBgcICQoLDA0ODw';
const ORIGINS = ['https://cavella.example'];

describe('card tokens', () => {
  it('recognises only 22-character base64url tokens', () => {
    expect(isCardToken(TOKEN)).toBe(true);
    expect(isCardToken('AAECAwQFBgcICQoLDA0OD')).toBe(false);
    expect(isCardToken('AAECAwQFBgcICQoLDA0OD+')).toBe(false);
    expect(isCardToken(undefined)).toBe(false);
  });

  it('builds the QR link with the token in the fragment only', () => {
    expect(cardLink('https://cavella.example/', TOKEN)).toBe(`https://cavella.example/c#${TOKEN}`);
    expect(() => cardLink('https://cavella.example', 'bad')).toThrow(RangeError);
  });
});

describe('parseCardPayload (scanned QR or typed text)', () => {
  it('accepts a bare token or our own card link', () => {
    expect(parseCardPayload(TOKEN, ORIGINS)).toBe(TOKEN);
    expect(parseCardPayload(`  ${TOKEN}\n`, ORIGINS)).toBe(TOKEN);
    expect(parseCardPayload(`https://cavella.example/c#${TOKEN}`, ORIGINS)).toBe(TOKEN);
    expect(parseCardPayload(`https://cavella.example/c/#${TOKEN}`, ORIGINS)).toBe(TOKEN);
  });

  it('rejects other sites, other paths, query strings and malformed tokens (E-18)', () => {
    expect(parseCardPayload(`https://evil.example/c#${TOKEN}`, ORIGINS)).toBeNull();
    expect(parseCardPayload(`https://cavella.example/menu#${TOKEN}`, ORIGINS)).toBeNull();
    expect(parseCardPayload(`https://cavella.example/c?x=1#${TOKEN}`, ORIGINS)).toBeNull();
    expect(parseCardPayload('https://cavella.example/c#short', ORIGINS)).toBeNull();
    expect(parseCardPayload('WIFI:S:cafe;T:WPA;P:secret;;', ORIGINS)).toBeNull();
  });
});

describe('card code for manual entry', () => {
  it('groups the token in fours and ignores whitespace when typed back', () => {
    const code = formatCardCode(TOKEN);
    expect(code).toBe('AAEC AwQF BgcI CQoL DA0O Dw');
    expect(normaliseCardCode(code)).toBe(TOKEN);
  });

  it('keeps - and _ because they are part of the token', () => {
    expect(normaliseCardCode('ab-_ cd')).toBe('ab-_cd');
  });
});
