/**
 * Card token helpers (ADR-002). The token is a 22-character base64url bearer secret; the QR code
 * encodes `<origin>/c#<token>` so a phone camera opens the card, and the fragment never reaches
 * any server.
 */

export const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Path of the card-link page that receives tokens from QR codes and saved links. */
export const CARD_LINK_PATH = '/c';

export function isCardToken(value: unknown): value is string {
  return typeof value === 'string' && CARD_TOKEN_PATTERN.test(value);
}

/** The link encoded in the card's QR code. */
export function cardLink(origin: string, token: string): string {
  if (!isCardToken(token)) throw new RangeError('Malformed card token');
  return `${origin.replace(/\/$/, '')}${CARD_LINK_PATH}#${token}`;
}

/**
 * Extracts a token from a scanned QR payload or typed text. Accepts a bare token or a card link
 * from one of `allowedOrigins`; anything else (other sites, other paths) returns null (PRD E-18).
 */
export function parseCardPayload(raw: string, allowedOrigins: readonly string[]): string | null {
  const text = raw.trim();
  if (isCardToken(text)) return text;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const pathOk = url.pathname === CARD_LINK_PATH || url.pathname === `${CARD_LINK_PATH}/`;
  if (!allowedOrigins.includes(url.origin) || !pathOk || url.search !== '') return null;
  const token = url.hash.slice(1);
  return isCardToken(token) ? token : null;
}

/** Groups the token for reading aloud or typing: "AAEC AwQF BgcI CQoL DA0O Dw". */
export function formatCardCode(token: string): string {
  return token.match(/.{1,4}/g)?.join(' ') ?? token;
}

/** Manual entry: whitespace is ignored; '-' and '_' are part of the code. */
export function normaliseCardCode(input: string): string {
  return input.replace(/\s+/g, '');
}
