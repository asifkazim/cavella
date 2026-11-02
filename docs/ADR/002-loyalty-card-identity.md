# ADR-002: Loyalty card identity, QR payload and recovery

| | |
|---|---|
| **Status** | **Proposed**, awaiting owner approval (**APR-03** in [ARCHITECTURE.md §0](../ARCHITECTURE.md#0-decisions-requiring-your-approval)) |
| **Date** | 2026-11-01 |
| **Deciders** | Owner (`[PLACEHOLDER: name]`), principal architect |
| **Related** | PRD FR-L-01–10, BR-01, T-03, T-04, T-10, E-06–E-08, E-18, E-19, J2, J3, J7, J8 · [ADR-001](001-technology-stack.md) |

## Context

The loyalty card must work **without registration, passwords or app installation**. The card is shown as a QR code that a cashier scans with a phone camera. The identity scheme must:

1. not be guessable or enumerable (T-03),
2. never let a customer add stamps (BR-01). That rule is enforced by staff authentication, but identity must not weaken it,
3. scan quickly and reliably from cracked or dim screens, and from paper (AC-S-01, E-08),
4. allow recovery on a new phone without collecting personal data (J8),
5. support pre-printed physical cards (FR-L-07, E-07),
6. limit damage if the database or logs leak (T-10, SEC-03),
7. stay simple and cheap.

## Options considered

### Option 1: Random bearer token (static QR) *(chosen)*
The card is identified by a 128-bit random secret. The QR encodes the card URL containing the token.
- ➕ Simplest. Works offline, on paper, from screenshots, from any copy. Easy recovery (any copy of the link restores the card). Small QR. Can be revoked and rotated server-side.
- ➖ A copied QR or link gives full control of the card, including redeeming its rewards (T-04). This is mitigated by the low value (one coffee), owner reissue, and staff seeing the last activity.

### Option 2: HMAC-signed card ID (`id.signature`)
The QR carries a card ID plus a server signature. Validity can be checked without a DB lookup.
- ➕ Forgery-proof without storage.
- ➖ Gives no protection over Option 1 against **copying**, which is the real threat. The DB lookup it saves costs about 1 ms at this volume. A key compromise lets an attacker forge every card. Rotation means re-printing physical cards. More complex, no benefit here.

### Option 3: Rotating, time-based QR (TOTP-style)
The card page holds a seed and shows a code that changes every ~30 s. The staff app validates it against server time.
- ➕ Screenshots and photos of the QR go stale quickly, so it defeats T-04.
- ➖ **Breaks paper cards and screenshot backups**, which are central to recovery and to customers without smartphones. Needs a correct device clock. The card page must be open and its JavaScript running, so it fails if the browser is evicted or the battery dies. Recovery still needs a long-lived secret, which brings back Option 1's copy risk at the recovery layer. Kept as a **future option** (PRD F-F-05) if abuse is ever observed.

### Option 4: Sequential or short numeric ID (+ optional PIN)
- ➖ Easily enumerable. A short PIN is brute-forceable and adds friction at the counter. Rejected.

| Criterion | 1 Random token | 2 HMAC ID | 3 Rotating QR | 4 Sequential |
|---|---|---|---|---|
| Unguessable | ✅ | ✅ | ✅ | ❌ |
| Resists copied QR | ❌ (accepted) | ❌ | ✅ | ❌ |
| Works on paper / screenshot | ✅ | ✅ | ❌ | ✅ |
| No-PII recovery | ✅ any copy | ✅ | ⚠ needs seed copy | ✅ |
| Safe if DB leaks | ✅ (hash only) | ⚠ key leak forges all | ⚠ seeds leak | ❌ |
| Complexity | Low | Medium | High | Low |

## Decision

Adopt **Option 1**. All values below are part of the decision.

### Token
- 16 bytes from `java.security.SecureRandom`, encoded as **unpadded base64url**: 22 characters, 128 bits.
- Generated **only on the server** (`POST /cards`, admin batches, reissue).
- The server stores **only `SHA-256(token)`** (`card.token_hash`, unique). A slow KDF isn't needed because the input is high-entropy. If the database leaks, it yields no usable card links.
- The token is returned to the client **exactly once** (creation or reissue response, or the batch PDF). The server can never show it again.

### QR payload and card URL
- `https://<domain>/c#<token>`. The token sits in the **URL fragment**.
  - Browsers never send fragments in HTTP requests or `Referer` headers, so the token stays out of Cloudflare, Pages and Caddy logs (SEC-03).
  - Phone camera apps open the full URL, fragment included, in the default browser.
  - The card page reads `location.hash` and sends the token to the API **only** in the `X-Card-Token` request header, never in a path or query.
- Payload is about 43–50 characters, encoded at error-correction level **M**, which gives QR version 4 (33×33 modules). (Corrected 2026-11-02: version 3 holds only 42 bytes, and `https://cavella.pl/c#` + 22 characters is 43.) Shown at **≥ 45 mm** with a 4-module quiet zone, with a high-contrast black-on-white tile even in dark mode.
- The staff scanner accepts **only** host `<domain>` (or the configured staging host), path `/c`, and a fragment matching `^[A-Za-z0-9_-]{22}$`. Anything else shows "Not a Cavella card" (E-18).

### Short card code (manual fallback, J7)
- A **separate** random value, not derived from the token: 40 bits → 8 Crockford Base32 characters (no I/L/O/U) plus 1 check character (Crockford mod-37). Displayed as `K7M2-QX9P-3`. Input is case-insensitive and hyphens are optional.
- Accepted **only** by `POST /staff/cards/lookup` with an authenticated staff session, rate-limited to 10/min/session, and logged. Repeated misses raise an anomaly flag (T-03).
- It **can't** be used on public endpoints, so knowing someone's short code gives no access outside the counter.

### Storage on the customer's device
- `localStorage['cavella.card']` = token, plus the last known `CardView` for offline display (NFR-P-05). The page URL keeps the fragment so bookmarks and the share sheet carry the card.
- The site's "My card" link reads `localStorage`. If nothing is stored, it offers "Get a card" or "I already have a card (scan or paste link)".

### Recovery and portability (J8, E-06)
1. **Any copy restores the card**: bookmark, home-screen icon, link sent to yourself, screenshot of the QR (scan it with the new phone's camera), or the printed card.
2. **"Save or move my card" panel** on the card page:
   - copy link,
   - share (`navigator.share`),
   - "show QR for your new phone",
   - home-screen instructions for iOS and Android.

   It is shown prominently while the card has 0–1 stamps (FR-L-05).
3. **Owner reissue**: if a card may have been copied, the owner rotates its token (`POST /admin/cards/{id}/reissue`). The balance and history are kept, the old token is rejected immediately, and a new link/QR is shown once for the customer to scan. Logged as a `REISSUE` event.
4. **Not in MVP:** opt-in email or phone recovery (FR-L-10). If added, it stores a contact linked to the card under explicit consent and adds GDPR obligations. It is a separate ADR.
5. **Otherwise, a lost card is lost.** This is said plainly at creation ("This card lives on this link. Save it.") and in the *regulamin*.

### Physical cards (FR-L-07, E-19)
- The admin creates a batch of N ≤ 200 cards. Each gets a token and short code. Cards are stored as `PREISSUED` with only the token hash. The server renders a print-ready PDF (QR + short code) **in one response, and the tokens are then discarded**. If the PDF is lost, that batch can't be reprinted. Create a new batch instead.
- A pre-issued card becomes `ACTIVE` on its first stamp. Scanning it with a phone opens the same card page, so a customer can move a paper card onto their phone.

### Lifecycle and privacy
- Empty self-issued cards are purged after 30 days. Any card with no events for 24 months is deleted together with its events (NFR-C-04).
- The card page shows at most 5 recent events with coarse times (T-10).

## Consequences

**Positive**
- Zero friction: one scan creates a usable card. Works for paper and smartphone users alike.
- Leaked databases and logs don't leak usable card credentials.
- Recovery needs no personal data and no support process beyond "keep a copy".
- The identity scheme is independent of the loyalty rules and of staff auth, so it can be replaced with Option 3 later without touching the ledger.

**Negative / accepted risks**
- **T-04 copied QR**: whoever holds a copy can redeem the card's rewards. Accepted given the value at stake. Detective controls: last-activity display, the `QUICK_SELF_REDEEM` anomaly rule, owner reissue.
- **Lost link = lost card**. Some customers will lose progress. The UI pushes saving the card early, and paper cards are offered.
- The server can never re-display a token. Staff can't "look up" a customer's link for them. Only a reissue gives a new one.

**Risks to resolve before implementation**
- **iOS home-screen storage isolation.** A web app added to the iOS home screen runs with storage separate from Safari and launches the manifest's `start_url`, which can't carry a per-card token.
  - **Spike (≤ 1 day):** verify that the `/c` route without a `start_url`/manifest makes iOS save the *current* URL including the fragment.
  - **Fallback:** detect standalone mode with no stored token and show a "paste your card link / scan your card QR" first-run screen.
  - **Acceptance:** on reference iOS and Android devices, adding the card to the home screen and reopening it from the icon shows the same card with its current balance.
- **In-app browsers** (for example opening the link from Instagram or Messenger) may have isolated storage. The fragment-in-URL approach still works, and the UI suggests "Open in browser" for saving.
