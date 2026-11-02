# Cavella — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Cavella public website + QR loyalty system |
| **Status** | Draft v0.1, written before implementation |
| **Date** | 2026-11-01 |
| **Owner** | `[PLACEHOLDER: product owner name]` |
| **Scope** | Requirements only. No application code. Technology choices are recorded as open decisions (§11). |

> **Placeholder convention.** Anything we don't know yet is written as `[PLACEHOLDER: …]` so it can be found with `grep -rn "PLACEHOLDER" .`. **Nothing marked as a placeholder may ship to production as-is** (see AC-REL-01).

---

## 1. Context and goals

Cavella is a small takeaway coffee kiosk next to a tram station in Poland (`[PLACEHOLDER: city]`, `[PLACEHOLDER: tram stop name]`). It sells coffee, toast, sweets and bottled drinks. Most customers are commuters who are short on time. Many of them come back daily and spend less than a minute at the counter.

### 1.1 Business goals
- **G1 — Get found and look trustworthy.** Someone searching "kawa [stop name]" finds Cavella, and within a few seconds of landing they can see the menu, prices, opening hours and how to get there.
- **G2 — More repeat visits.** Give commuters a reason to pick Cavella over a competitor on their route by rewarding every 6 qualifying purchases with a free coffee.
- **G3 — Keep the queue moving.** A loyalty interaction should add almost nothing to service time.
- **G4 — Keep running costs low.** Hosting and services should fit within roughly `[PLACEHOLDER: monthly budget, assumed ≤ 100 PLN/month]`, with no per-transaction fees.

### 1.2 Product goals (measured in §10.3)
- A cashier can scan a card and confirm a stamp in **≤ 5 seconds** (median), counted from the moment the scanner is on screen.
- A customer can get a card without any account, password or app install, in **≤ 15 seconds**.
- **Zero** confirmed cases of a reward being redeemed twice, or of a stamp being added without an authenticated staff action.

### 1.3 Non-goals (explicitly out of scope)
- Online ordering, pre-ordering or delivery.
- Online payments of any kind.
- Integration with the fiscal cash register or POS (for MVP; see §9.3 F-F-01).
- Customer accounts, social login and marketing email/SMS.
- Native mobile apps.

---

## 2. Assumptions

These are working assumptions. Each one should be confirmed or corrected by the owner. Anything that would change the design significantly if wrong is also listed as a decision in §11.

| ID | Assumption |
|---|---|
| A-01 | The kiosk has **one service point** and 1–2 cashiers on shift. |
| A-02 | The cashier uses a **smartphone with a rear camera**, running a current Chrome (Android) or Safari (iOS). Whether this is a kiosk-owned or personal phone is open (D-05). |
| A-03 | There is **mobile data coverage** at the kiosk (LTE/5G near a tram station). Short outages can happen. |
| A-04 | **Polish** is the primary language and **English** the secondary one (students, expats, tourists). |
| A-05 | Prices are shown in **PLN, gross (VAT included)**, as Polish consumer law requires. |
| A-06 | The time zone is **Europe/Warsaw**, and daylight saving time applies. |
| A-07 | A "qualifying purchase" is **one paid coffee-based drink**. Toast, sweets and bottled drinks don't qualify. A free reward coffee doesn't earn a stamp. *(Owner to confirm: D-01.)* |
| A-08 | The reward is **one free coffee of any size/type on the menu** (`[PLACEHOLDER: reward eligibility, e.g. "any coffee up to 400 ml"]`). *(D-02)* |
| A-09 | Six stamps earn one reward. Further stamps keep counting toward the next reward, so rewards can **accumulate**. *(D-03)* |
| A-10 | Customers don't need to give any personal data to use the loyalty card. |
| A-11 | Fewer than ~2,000 active cards and ~500 stamp events per day in the first year. That is small enough for a single managed database instance. |
| A-12 | Menu content (items, prices, availability) changes **a few times per month at most**. |
| A-13 | One owner/admin manages staff accounts and content. |

---

## 3. Actors

| Actor | Description | Authentication |
|---|---|---|
| **Visitor** | Anyone browsing the public website: commuters, people walking by, search engines. | None |
| **Customer (cardholder)** | A visitor who holds a digital loyalty card. Anonymous: identified only by the card's secret token. | **Possession of the card link/QR** (bearer token). No account. |
| **Cashier** | Staff member serving customers. Scans cards, adds stamps, redeems rewards, voids mistakes. | Required: individual staff account. |
| **Owner / Admin** | Runs the business. Manages staff, loyalty rules, website content; looks at reports and the audit log. | Required: individual account with the admin role and a stronger login (D-06). |
| **System** | Background jobs: card cleanup, anomaly flags, backups. | n/a |
| **Attacker** (threat actor) | An outsider, a dishonest customer, or a dishonest/compromised staff account. See §6. | n/a |

---

## 4. User journeys

### J1 — Visitor checks the kiosk (website)
1. The visitor finds Cavella via Google search or Maps, a QR sticker on the kiosk, or a shared link.
2. The landing page shows above the fold, on a 360×640 screen: brand, **open/closed now** status, today's hours, and buttons for **Menu** and **Directions**.
3. Opens Menu → sees categories (Coffee, Toast, Sweets, Drinks) with names, sizes and prices.
4. Opens Location → sees the address, the tram stop, a short "how to find us" note, a static map image, and a button that opens their maps app.
5. Can switch between PL and EN at any time.

### J2 — Customer gets a loyalty card (first visit)
1. At the counter, the customer scans a **"Get your Cavella card"** QR code (on a sticker, or shown on the cashier's screen).
2. The card page opens in their browser and **a new card is created** straight away. It shows a QR code, the stamp grid 0/6, and a short card code.
3. The page asks them to **save the card**: add it to the home screen (with instructions for iOS and Android), bookmark it, or take a screenshot of the QR.
4. The cashier scans the new card and adds the first stamp for today's purchase (J4).
5. **Fallback for people without a smartphone, or who don't want one:** the cashier hands over a **printed physical card** with a pre-generated QR (F-08, MVP-should).

### J3 — Returning customer opens their card
1. The customer opens the saved home-screen icon or bookmark. The browser has the card stored locally, or the URL itself contains the card token.
2. The card shows the QR, current stamps (for example 4/6), available rewards, and the last 5 activity entries.
3. The screen is at full brightness-friendly contrast and the QR is at least 45 mm wide on a typical phone, so it scans easily.

### J4 — Cashier adds a stamp (core, high-frequency)
1. The cashier is already logged in on the staff app, which stays signed in for the whole shift. The **Scan** screen opens with the camera active.
2. The customer shows their card QR → it is decoded in under 1 second.
3. The cashier sees a **card summary**: stamps n/6, rewards available, time of the last stamp, and any warning (for example "Stamped 2 min ago").
4. The cashier sets the number of qualifying drinks (default **1**, stepper up to the cap, FR-S-06) and taps **Confirm**.
5. A clear success state appears (colour + icon + text + haptic) along with the new balance. The scanner resets automatically for the next customer.
6. If the stamp completes a set of 6, the success screen says **"Reward earned!"** and the customer's card shows it the next time it refreshes.

### J5 — Cashier redeems a reward
1. Scan the card → the summary shows "1 reward available".
2. The cashier taps **Redeem reward** → a confirmation step appears ("Give 1 free coffee?").
3. Confirm → the server atomically uses up one reward → success screen. Rewards available goes down by 1.
4. If the customer also buys other qualifying drinks in the same visit, the cashier can add stamps for them in the same flow. Redeeming and stamping are separate, individually confirmed actions.

### J6 — Cashier corrects a mistake
1. Right after confirming, the success screen offers **Undo** for `[PLACEHOLDER: void window, assumed 2 minutes]`.
2. After that window, only the Owner can void a transaction from the audit log, and must give a reason.
3. A void is a new compensating event. Nothing is ever deleted.

### J7 — QR won't scan (fallback)
1. The customer's screen is cracked, too dim, or the camera can't focus.
2. The cashier taps **Enter code** and types the short card code shown under the QR (for example `K7M2-QX9P`).
3. The flow then continues as in J4/J5. Manual lookups are rate-limited and recorded in the log.

### J8 — Customer lost their card
1. **MVP:** if the customer still has the link, a screenshot or the physical card, they scan or open it to get the card back on a new device. If not, **the card is lost**. This is stated clearly when the card is created ("This card lives on this link. Save it.").
2. **Future (F-F-03):** optional recovery by email or phone, which the customer opts into.

### J9 — Owner manages the system
1. Logs in to the admin area.
2. Adds or deactivates cashier accounts. Deactivating a cashier ends their sessions immediately.
3. *(MVP-should)* Edits menu items, prices, availability and opening hours, including holiday exceptions.
4. Looks at daily totals (stamps, redemptions, new cards) per cashier, plus the audit log and anomaly flags.

---

## 5. Functional requirements

Priority uses **MoSCoW**: **M** = Must (MVP), **S** = Should (MVP if time allows, otherwise right after launch), **C** = Could (future), **W** = Won't (this version).

### 5.1 Public website (FR-W)

| ID | Requirement | Pri |
|---|---|---|
| FR-W-01 | Mobile-first landing page with brand identity (logo `[PLACEHOLDER: logo asset]`, palette `[PLACEHOLDER: brand colours]`, hero image `[PLACEHOLDER: hero photo]`). | M |
| FR-W-02 | **Open-now indicator** worked out from the opening hours in Europe/Warsaw time, including holiday exceptions. Shows "Open · closes 18:00" / "Closed · opens Mon 6:30". | M |
| FR-W-03 | Opening hours per weekday (`[PLACEHOLDER: weekly hours]`) plus a list of upcoming exceptions (`[PLACEHOLDER: public holiday schedule]`). | M |
| FR-W-04 | Menu with categories Coffee / Toast / Sweets / Drinks. Each item has a name (PL/EN), an optional short description, size variants, and a gross price in PLN (`[PLACEHOLDER: price]` for every item until confirmed). | M |
| FR-W-05 | Items can be marked **temporarily unavailable** or **seasonal**. | S |
| FR-W-06 | Allergen information per item, or a clear note telling customers to ask staff (`[PLACEHOLDER: allergen data]`). | M (note) / S (per-item) |
| FR-W-07 | Location section: address `[PLACEHOLDER: street address]`, tram stop and lines `[PLACEHOLDER: tram lines]`, a short wayfinding text, a **static map image**, and a "Directions" deep link to Google/Apple Maps. No embedded third-party map iframe (privacy and performance). | M |
| FR-W-08 | PL/EN language switch. Language choice remembered. `hreflang` set correctly. | M |
| FR-W-09 | Loyalty programme explainer ("6 coffees → 1 free") with a link to get a card. | M |
| FR-W-10 | Contact/social links (`[PLACEHOLDER: Instagram/Facebook URLs]`, `[PLACEHOLDER: contact email/phone]`). | S |
| FR-W-11 | SEO: unique titles and meta descriptions, Open Graph image, `schema.org/CafeOrCoffeeShop` structured data (address, geo, hours, price range), sitemap, robots.txt. | M |
| FR-W-12 | Legal pages: privacy policy (RODO/GDPR), loyalty programme terms (*regulamin*), and the business details required by Polish law (`[PLACEHOLDER: company name, NIP, registered address]`). | M |
| FR-W-13 | Web app manifest + icons so the site and the card can be installed on the home screen. | M |
| FR-W-14 | Owner can edit menu, prices, availability and hours without a developer (see D-08). | S |

### 5.2 Loyalty: customer side (FR-L)

| ID | Requirement | Pri |
|---|---|---|
| FR-L-01 | Create a card with **no personal data and no account**. Each card has a high-entropy secret token (≥ 128 bits, from a CSPRNG) and a short, human-typable **card code** (D-04). | M |
| FR-L-02 | The card URL holds the token (for example `/c/{token}`). The token is also stored on the device (local storage) so the card can be reopened from the site's "My card" link. | M |
| FR-L-03 | The card page shows the QR (encoding the card URL), the short card code, stamps n/6 as a visual grid, rewards available, and the last 5 events (stamp / redeem / void, with relative time). | M |
| FR-L-04 | The card page refreshes its balance on open and when it regains focus. Optional light polling (≤ every 10 s, only while visible) so the customer sees a stamp land while still at the counter. | M (on focus) / S (polling) |
| FR-L-05 | "Save your card" guidance: add to home screen (iOS/Android instructions), bookmark, screenshot. Shown after creation and while the card has 0 stamps. | M |
| FR-L-06 | Card creation is rate-limited per IP/device (for example ≤ 5 per hour) and protected against automated mass creation. Cards with 0 stamps after `[PLACEHOLDER: 30]` days are deleted automatically. | M |
| FR-L-07 | Pre-generated **physical cards**: the owner can export a batch of N card QRs as a print-ready PDF. A physical card is activated by its first stamp. | S |
| FR-L-08 | Programme terms shown on the card page (rules, reward expiry if any, link to *regulamin*). | M |
| FR-L-09 | Add to Apple Wallet / Google Wallet. | C |
| FR-L-10 | Optional opt-in recovery contact (email or phone) to restore a lost card. | C |

### 5.3 Loyalty: staff side (FR-S)

| ID | Requirement | Pri |
|---|---|---|
| FR-S-01 | Staff login with an **individual account** per person. No shared credentials. | M |
| FR-S-02 | Sessions last a full shift (`[PLACEHOLDER: 12 h]`) and expire after that. The owner can revoke all sessions of a user immediately. | M |
| FR-S-03 | In-browser **camera QR scanner** on the Scan screen. Rear camera by default, torch toggle where supported, continuous scanning with decode in ≤ 1 s under normal light. | M |
| FR-S-04 | Manual card-code entry as a fallback to scanning. | M |
| FR-S-05 | Card summary after scan: stamps n/6, rewards available, last activity time, and warnings (recent stamp, card flagged, card created < 1 min ago). | M |
| FR-S-06 | **Add stamps**: quantity stepper, default 1, maximum `[PLACEHOLDER: per-transaction cap, assumed 3]`. Requires an explicit Confirm tap. | M |
| FR-S-07 | **Redeem reward**: only possible when rewards available ≥ 1. Requires a separate explicit confirm. Redeems exactly one reward per confirm. | M |
| FR-S-08 | **Undo** of the cashier's own last action within the void window (J6). | M |
| FR-S-09 | Clear, accessible result states: success, already processed (duplicate), no reward available, card not found, card blocked, network error with safe retry. | M |
| FR-S-10 | The Scan screen resets automatically to scanning after success (≤ 3 s, or straight away on tap) to support back-to-back customers. | M |
| FR-S-11 | Shift summary on the staff device: stamps given and rewards redeemed by me today. | S |

### 5.4 Admin (FR-A)

| ID | Requirement | Pri |
|---|---|---|
| FR-A-01 | Create, deactivate and reset staff accounts. Assign the role (cashier / owner). | M |
| FR-A-02 | **Append-only audit log** of every loyalty event (card id, action, quantity, staff user, device/session id, timestamp, idempotency key, void reference), filterable by date / staff / card. | M |
| FR-A-03 | Daily report: stamps, redemptions, voids and new cards, per cashier and in total. CSV export. | M |
| FR-A-04 | Owner void of any event, with a mandatory reason. | M |
| FR-A-05 | **Block / unblock a card** (suspected fraud). A blocked card can't receive stamps or redeem rewards. | M |
| FR-A-06 | Anomaly flags (§6.3) shown in the admin area. | S |
| FR-A-07 | Configure loyalty rules: stamps per reward (default 6), per-transaction cap, cooldown, reward expiry. Rule changes are logged and apply only from that point on. | S |
| FR-A-08 | Edit website content (FR-W-14). | S |

### 5.5 Loyalty business rules (BR)

| ID | Rule |
|---|---|
| BR-01 | A stamp can be created **only** by an authenticated staff session through an explicit confirm. No public endpoint can change a balance. |
| BR-02 | Every completed set of **6 stamps** gives **1 reward**. Stamps over the threshold carry forward (`stamps_toward_next = total_valid_stamps mod 6`). |
| BR-03 | Rewards can accumulate (A-09) unless the owner sets a cap or expiry (D-03). |
| BR-04 | Redeeming a reward **doesn't** earn a stamp. |
| BR-05 | A balance can never go negative. Redeeming with 0 rewards available is rejected by the server, whatever the client shows. |
| BR-06 | Every write carries a **client-generated idempotency key**. Retrying the same key never applies the action twice. |
| BR-07 | The balance is **derived from the event log** (event sourcing or ledger + cached balance updated in the same transaction). It is never edited directly. |
| BR-08 | Voids are compensating events that refer to the original. An event can be voided only once. |
| BR-09 | Stamps per card per rolling `[PLACEHOLDER: 10]` minutes are capped at the per-transaction cap. Going above it requires owner override or is flagged (D-07). |
| BR-10 | A blocked card is read-only for staff, and the card page says "Card inactive — ask staff". |

---

## 6. Security and abuse

### 6.1 Threat model

| # | Threat | Actor | Impact | Mitigation (MVP) |
|---|---|---|---|---|
| T-01 | **Self-stamping**: a customer forges a request to add stamps. | Outsider | Free coffee | BR-01: write endpoints need a staff session with server-side role check. Customer-facing endpoints are read-only. |
| T-02 | **Double redemption** through a double tap, a network retry, or two cashiers scanning at once. | Accidental / dishonest customer | Free coffee | BR-05 and BR-06: idempotency keys plus an atomic conditional update in a DB transaction (`rewards_available ≥ 1` checked and decremented together, or a serializable ledger insert). UI disables Confirm after the first tap. |
| T-03 | **Card token guessing / enumeration**. | Outsider | Read others' balances; redeem their rewards at the counter | 128-bit random token. The short code is **only accepted from authenticated staff** and is rate-limited. Generic "not found" responses. Rate limiting on public card reads. |
| T-04 | **Screenshot / link sharing**: a card QR is shared or stolen and someone else redeems the reward. | Customer / friend | One coffee | Accepted risk for MVP (low value, a bearer card behaves like a paper card). Staff see the last activity. A rotating/time-limited QR is a future option (F-F-05, D-09). |
| T-05 | **Dishonest cashier** stamps friends' cards without a purchase, or redeems rewards for themselves. | Insider | Revenue loss | Individual accounts, append-only audit log, per-cashier daily reports, anomaly flags, reconciliation of stamps against fiscal-register coffee sales by the owner (manual in MVP). **Can't be fully prevented without POS integration** (F-F-01). |
| T-06 | **Staff credential theft / lost staff phone**. | Outsider | Unlimited stamps | Strong passwords or passkeys, admin MFA (D-06), shift-length sessions, instant remote revocation, re-auth/PIN lock after `[PLACEHOLDER: 5]` minutes idle (D-05), login rate-limiting and lockout. |
| T-07 | **Mass card creation / DB spam**. | Bot | Cost, noise | FR-L-06 rate limits, a bot challenge if abuse is detected, auto-purge of empty cards. |
| T-08 | **Replay of a captured staff request**. | Outsider on the network | Extra stamps | HTTPS only (HSTS). Idempotency keys are single-use. CSRF protection on cookie-authenticated endpoints. |
| T-09 | **XSS / injection** via admin-editable content. | Insider / compromised admin | Account takeover | Output encoding, strict Content-Security-Policy, no raw HTML in content fields, parameterised queries. |
| T-10 | **Privacy leak**: a card's history reveals someone's commuting pattern. | Anyone with the token | Privacy | Minimal data. The card page shows only the last 5 events with coarse times. No IP stored with loyalty events beyond what security logs need (retention `[PLACEHOLDER: 30 days]`). |

### 6.2 Security requirements
- **SEC-01** HTTPS everywhere, HSTS, secure/HttpOnly/SameSite cookies for staff sessions.
- **SEC-02** Authorisation is checked **on the server** for every staff and admin action. The client UI is never trusted.
- **SEC-03** Card tokens are never written to analytics, error-tracking breadcrumbs or third-party services. The card page sends `Referrer-Policy: no-referrer`.
- **SEC-04** Passwords are hashed with a modern memory-hard algorithm (Argon2id or bcrypt with an appropriate cost), or passkeys are used instead.
- **SEC-05** Login, manual code lookup, card creation and public card reads are rate-limited.
- **SEC-06** Daily automated database backups, kept for `[PLACEHOLDER: 14]` days. A restore procedure is written down and tested once before launch.
- **SEC-07** Dependencies are scanned for known vulnerabilities in CI.

### 6.3 Anomaly flags (FR-A-06)
- A card receives more than `[PLACEHOLDER: 6]` stamps in one day.
- A cashier gives more than `[PLACEHOLDER: X]` stamps per hour, or a share of stamps per shift well above the median.
- A card that is less than 5 minutes old gets the per-transaction cap.
- A redemption within `[PLACEHOLDER: 5]` minutes of the stamp that earned it, by the same cashier.
- Repeated "not found" manual-code lookups from one session.

---

## 7. Edge cases

| # | Situation | Expected behaviour |
|---|---|---|
| E-01 | Network drops after the cashier taps Confirm but before the response. | The client retries with the **same idempotency key**. The server returns the original result. The UI shows "Checking…" and then the final state. No double stamp. |
| E-02 | Cashier double-taps Confirm. | Button disabled on the first tap, and the shared idempotency key stops a second apply anyway. |
| E-03 | Two cashiers scan the same card at once, both redeem. | Exactly one succeeds. The other sees "No reward available (just redeemed)". |
| E-04 | The 6th stamp and a redemption happen in the same visit. | The cashier stamps first (reward becomes available), then redeems as a separate confirmed action. Allowed, because the customer earned it with this purchase. *(Owner may disallow: D-03.)* |
| E-05 | Mobile data is down for a long time at the kiosk. | **MVP: no offline stamping.** The staff app shows a clear offline banner, and the cashier tells the customer the stamp can't be added right now (owner may add it later through admin). Offline queuing is deliberately left out because it makes double-redemption prevention much harder (D-10). |
| E-06 | Customer cleared browser data, or switched phones. | The card can be recovered only from the link, a screenshot of the QR, or the physical card (J8). Stated clearly when the card is created and in the terms. |
| E-07 | Customer has no smartphone, or no battery. | Physical card (FR-L-07). If not available: no stamp, and the customer is offered a physical card. |
| E-08 | QR unreadable (glare, cracked screen, low brightness). | Torch toggle, "increase brightness" hint on the card page, manual short-code entry. |
| E-09 | Camera permission denied or unavailable on the staff device. | Clear instructions to re-enable it, and manual code entry stays available. |
| E-10 | Customer presents two cards. | MVP: staff stamp only one, chosen by the customer. Merging cards is a future admin feature (F-F-04). |
| E-11 | Purchase refunded after stamping. | Cashier undoes within the window, or the owner voids it later with a reason. |
| E-12 | Customer refuses or forgets the card. | No retroactive stamps in MVP, except an owner manual adjustment (logged with a reason). |
| E-13 | Cashier leaves the job, or their phone is stolen. | Owner deactivates the account and every session ends within ≤ 60 s. |
| E-14 | Loyalty rules change (for example 6 → 8). | Existing progress is kept. The new threshold applies to future rewards only, and is announced in the terms. *(Exact transition policy: D-03.)* |
| E-15 | Clock skew on the staff device. | All timestamps come from the server. Client time is ignored for business logic. |
| E-16 | DST change / midnight boundary. | Open-now, daily reports and "per day" anomaly rules use Europe/Warsaw local time. |
| E-17 | The kiosk is closed but someone tries to stamp. | Allowed (the staff may be working late), but flagged if outside opening hours + `[PLACEHOLDER: 30]` min. |
| E-18 | Someone scans a non-Cavella QR code, or a Cavella URL for a deleted card. | "Not a Cavella card" / "Card not found". No crash, no information leaked. |
| E-19 | Physical card that was never activated gets lost. | Harmless: it has no balance. Unactivated batch cards don't expire through the empty-card purge (they are marked as pre-issued). |
| E-20 | Bot traffic hits public card URLs. | Rate-limited. Responses don't show whether a token exists until a valid token is given. |

---

## 8. Non-functional requirements

### 8.1 Performance (public site and card page)
- **NFR-P-01** Lighthouse mobile Performance ≥ **95** on the landing, menu and card pages.
- **NFR-P-02** Largest Contentful Paint ≤ **2.0 s** at p75 on a simulated mid-range Android over "Fast 4G". INP ≤ **200 ms**, CLS ≤ **0.05**.
- **NFR-P-03** Landing page transfer size ≤ **300 KB** compressed on first load, including the hero image. JavaScript ≤ **70 KB** compressed on public pages.
- **NFR-P-04** Images are served in modern formats (AVIF/WebP) at responsive sizes and lazy-loaded below the fold.
- **NFR-P-05** The card page is still usable when its assets are cached and the network is briefly down: it shows the last known balance, clearly marked as possibly out of date, and the QR always renders, because the QR is generated on the device from the token.

### 8.2 Performance (staff flow)
- **NFR-S-01** Server response time for stamp/redeem/lookup ≤ **300 ms p95** (measured at the server), ≤ **800 ms p95** end-to-end on LTE.
- **NFR-S-02** QR decode ≤ **1 s** from the code entering the frame under normal indoor/outdoor light.
- **NFR-S-03** Scan screen ready (camera live) ≤ **1.5 s** after opening the app on an already-authenticated device.

### 8.3 Accessibility
- **NFR-A-01** Meet **WCAG 2.2 Level AA** on all public, card, staff and admin pages.
- **NFR-A-02** Every interactive element can be used with a keyboard and a screen reader (TalkBack and VoiceOver tested). Touch targets ≥ **44×44 CSS px**.
- **NFR-A-03** Status is never shown by colour alone (success/error use an icon + text). Text contrast ≥ 4.5:1.
- **NFR-A-04** Respects `prefers-reduced-motion` and the system font size up to 200% without loss of content.
- **NFR-A-05** The stamp count on the card is announced as text ("4 of 6 stamps, 2 more to a free coffee"), not just as a graphic.
- **NFR-A-06** Language is declared correctly (`lang="pl"` / `lang="en"`).

### 8.4 Reliability and availability
- **NFR-R-01** Monthly availability target **99.5%** during opening hours (about 3.6 h/month unplanned downtime allowed).
- **NFR-R-02** No loss of confirmed loyalty events (RPO ≤ 24 h through daily backups, with point-in-time recovery if the provider offers it at no extra cost). RTO ≤ 4 h.
- **NFR-R-03** The public website stays available even if the loyalty backend is down (static/CDN delivery).

### 8.5 Privacy and compliance (Poland / EU)
- **NFR-C-01** RODO/GDPR: data minimisation. The loyalty card holds no direct personal data. Card IDs and event history are treated as **pseudonymous personal data** and covered by the privacy policy. Staff account data is personal data.
- **NFR-C-02** **No non-essential cookies or trackers** by default. If analytics are used, they must be cookieless/privacy-friendly, so **no consent banner** is needed. If that changes, a compliant consent mechanism becomes mandatory.
- **NFR-C-03** No third-party embeds on public pages that set cookies (maps, social widgets, external fonts loaded at runtime). Fonts are self-hosted.
- **NFR-C-04** Card data retention: inactive cards (no events for `[PLACEHOLDER: 24]` months) are deleted, and the terms say so.
- **NFR-C-05** Loyalty *regulamin* published and versioned (PL authoritative, EN translation).
- **NFR-C-06** Prices shown as gross PLN (A-05).
- **NFR-C-07** Accessibility law: confirm whether the business counts as a microenterprise exempt from the Polish implementation of the European Accessibility Act. NFR-A-01 applies regardless (D-12).

### 8.6 Operability and cost
- **NFR-O-01** Monthly running cost ≤ `[PLACEHOLDER: budget]` at the A-11 volume. No per-transaction fees.
- **NFR-O-02** Error tracking and uptime monitoring with an alert to the owner, on free/low-cost tiers. Card tokens are scrubbed (SEC-03).
- **NFR-O-03** Deploys are automated from the main branch, and a rollback takes ≤ 10 minutes.
- **NFR-O-04** Staff onboarding: a new cashier can do J4 and J5 correctly after **≤ 5 minutes** of explanation.

### 8.7 Compatibility
- **NFR-B-01** Public and card pages: the last 2 major versions of iOS Safari, Chrome Android, Samsung Internet, Firefox, and desktop Chrome/Safari/Firefox/Edge.
- **NFR-B-02** Staff app: current iOS Safari and Chrome Android (camera access needs HTTPS and a recent browser).
- **NFR-B-03** Layout works from **320 px** wide up to desktop.

---

## 9. MVP vs. future

### 9.1 MVP (launch scope)
**Website:** FR-W-01 to 04, 06 (note), 07, 08, 09, 11, 12, 13.
**Loyalty, customer side:** FR-L-01 to 06, 08.
**Loyalty, staff side:** FR-S-01 to 10.
**Admin:** FR-A-01 to 05.
**Rules:** BR-01 to BR-10 (rule values hard-configured, not editable in the UI).
**All Must NFRs and SEC-01 to 07.**

### 9.2 MVP-should (if time allows, otherwise release 1.1)
FR-W-05, FR-W-10, FR-W-14 / FR-A-08 (owner-editable content), FR-L-04 polling, FR-L-07 (physical cards), FR-S-11, FR-A-06 (anomaly flags), FR-A-07 (rules config UI).

### 9.3 Future (post-MVP backlog)
| ID | Feature | Rationale / dependency |
|---|---|---|
| F-F-01 | POS / fiscal-register integration so stamps are tied to actual receipts. | Strongest defence against insider fraud (T-05). Depends on the register vendor `[PLACEHOLDER: fiscal register model]`. |
| F-F-02 | Apple Wallet / Google Wallet passes. | Better retention; Apple needs a paid developer account. |
| F-F-03 | Optional card recovery by email or phone (opt-in). | Solves E-06; adds personal data and GDPR obligations. |
| F-F-04 | Merge two cards (admin). | E-10. |
| F-F-05 | Rotating / time-limited QR (TOTP-style signed payload). | Reduces T-04. Costs a more complex card page and needs a clock-tolerant server. |
| F-F-06 | Offline staff mode with signed, queued stamps (no offline redemptions). | E-05. Needs careful conflict design. |
| F-F-07 | Promotions (e.g. double-stamp days), seasonal menu highlights. | Marketing. |
| F-F-08 | Pre-ordering for pickup. | Big scope change (payments, kitchen flow). |
| F-F-09 | Multi-location support. | Only if the business expands. |
| F-F-10 | More languages (UA is a likely candidate). | Customer demographics. |

---

## 10. Acceptance criteria

Each criterion can be tested. "Reference device" = a mid-range Android (`[PLACEHOLDER: e.g. Samsung Galaxy A3x/A5x]`) running current Chrome, plus an iPhone (`[PLACEHOLDER: model]`) running current Safari.

### 10.1 Website
- **AC-W-01** On a 360×640 viewport, the landing page shows the brand, open/closed status, today's hours, and the Menu and Directions buttons **without scrolling**.
- **AC-W-02** With the hours set to Mon–Fri 06:30–18:00, the indicator shows "Open" at 06:30:00 and "Closed" at 18:00:00 Europe/Warsaw time, including on the DST transition days (tested by mocking the clock).
- **AC-W-03** Every menu item shows a price in the format `12,00 zł` (Polish locale) or `[PLACEHOLDER: price]`. No item renders without a price field.
- **AC-W-04** "Directions" opens the native maps app on iOS and Android, pointing at `[PLACEHOLDER: coordinates]`.
- **AC-W-05** Lighthouse mobile scores on landing, menu and card pages: Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95, SEO ≥ 95 (median of 3 runs).
- **AC-W-06** Core Web Vitals at p75 (field data once there is enough traffic; lab before that): LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.05.
- **AC-W-07** Automated axe-core scan finds **0 serious/critical** violations. A manual VoiceOver + TalkBack walkthrough of J1–J3 completes without blockers.
- **AC-W-08** No cookies are set and no requests go to third-party domains on public pages (checked in DevTools / automated test), except explicitly approved privacy-friendly analytics.
- **AC-W-09** Structured data passes Google's Rich Results Test with no errors.
- **AC-W-10** Switching PL ↔ EN changes all UI strings. No mixed-language strings remain (automated check that no translation key is missing).

### 10.2 Loyalty
- **AC-L-01** A new user with no prior site data gets a card showing a QR and 0/6 in **≤ 15 s** from scanning the "Get your card" QR (median of 10 trials on reference devices, LTE).
- **AC-L-02** Card tokens have ≥ 128 bits of entropy from a CSPRNG (code review + test asserting length/charset). Card URLs are never sequential.
- **AC-L-03** No public, unauthenticated request can change any card balance (automated API test: every write endpoint returns 401/403 without a valid staff session).
- **AC-L-04** **Idempotency:** sending the same stamp request (same idempotency key) 10 times, concurrently and sequentially, gives exactly **1** stamp event.
- **AC-L-05** **No double redemption:** with 1 reward available, 20 concurrent redeem requests with *different* idempotency keys from 2 staff sessions give exactly **1** success and 19 "no reward available" responses. The final balance is 0 rewards.
- **AC-L-06** After 6 confirmed stamps the card shows 1 reward available and 0/6 toward the next. After a 7th stamp: 1 reward, 1/6.
- **AC-L-07** Redeeming when rewards available = 0 is rejected by the server, even if the client sends the request directly.
- **AC-L-08** A stamp request with quantity greater than the per-transaction cap is rejected by the server.
- **AC-L-09** A voided event no longer counts toward the balance. A second void of the same event is rejected. Both void and original remain in the audit log.
- **AC-L-10** The card page shows the updated balance within **≤ 10 s** of a stamp while it is open and visible (if FR-L-04 polling is in scope), or immediately on refocus.
- **AC-L-11** Manual code lookup is rejected without a staff session and is rate-limited to `[PLACEHOLDER: 10]` per minute per session.
- **AC-L-12** A blocked card can't be stamped or redeemed (server-side test), and the staff UI shows "Card blocked".

### 10.3 Staff experience and operations
- **AC-S-01** **Speed:** median time from "card QR in front of camera" to "success screen" ≤ **5 s**, p90 ≤ **8 s**, over 30 timed trials by a trained cashier on the reference device over LTE.
- **AC-S-02** The staff app shows a distinct, accessible state for each of: success, duplicate, no reward, not found, blocked, offline, error. Each is verified by a test that forces it.
- **AC-S-03** Deactivating a staff account makes the next request from any of that user's sessions fail within **≤ 60 s**.
- **AC-S-04** Every stamp, redemption and void appears in the audit log with staff user, timestamp and idempotency key (100% of events, checked by an automated test).
- **AC-S-05** Daily report totals match the count of audit-log events for that Europe/Warsaw calendar day (automated test across a DST boundary).
- **AC-S-06** A staff member new to the app does J4 + J5 + J6 correctly after ≤ 5 minutes of explanation (usability test with ≥ 3 people).
- **AC-S-07** Staff login is locked out or throttled after `[PLACEHOLDER: 5]` failed attempts within 15 min.

### 10.4 Release gates
- **AC-REL-01** `grep -rn "PLACEHOLDER"` over shipped content and config returns **0 results** at production launch (prices, address, hours, legal details, assets all filled in).
- **AC-REL-02** Privacy policy and loyalty *regulamin* published and reviewed by the owner (and by a legal advisor if D-11 says so).
- **AC-REL-03** Backup restore tested successfully once in a staging environment.
- **AC-REL-04** Monthly cost estimate at A-11 volume written down and ≤ NFR-O-01 budget.

### 10.5 Business KPIs (tracked after launch, not release blockers)
- Cards created per week; share of cards with ≥ 2 stamps after 30 days (target `[PLACEHOLDER: ≥ 40%]`).
- Share of coffee sales with a stamp (needs a manual tally against the register; target `[PLACEHOLDER]`).
- Redemptions per week, and redemption rate per completed reward.
- Website: monthly visits, Directions clicks, "Get card" clicks.

---

## 11. Unresolved decisions

| ID | Decision | Options | Proposed default | Owner |
|---|---|---|---|---|
| D-01 | What counts as a qualifying purchase? | (a) per coffee drink, (b) per transaction ≥ X PLN, (c) any item | (a) per coffee drink | Owner |
| D-02 | Which items can be taken as the reward? | Any coffee / up to a size / up to a price | Any coffee up to `[PLACEHOLDER]` ml | Owner |
| D-03 | Can rewards accumulate, do they expire, can you stamp and redeem in the same visit, and what happens to progress when rules change? | — | Accumulate, no expiry in MVP, same-visit allowed, progress kept | Owner |
| D-04 | Short card code format | 8 chars Crockford Base32 with a check char vs. numeric | 8 Base32 + check (e.g. `K7M2-QX9P`), no ambiguous chars | Tech |
| D-05 | Staff device: kiosk-owned phone vs. personal phones (BYOD); idle PIN lock? | — | Kiosk-owned phone + per-user login + 4–6 digit idle PIN re-unlock | Owner + Tech |
| D-06 | Staff authentication method | Email+password, magic link, passkeys; MFA for owner | Passkeys or password for cashiers; **MFA required for owner** | Tech |
| D-07 | Cooldown behaviour (BR-09) | Hard block vs. warning + flag | Warning + flag (don't slow the queue) | Owner |
| D-08 | How is website content managed? | (a) files edited by a developer + redeploy, (b) built-in admin editor, (c) headless CMS free tier | (a) for MVP, (b) in 1.1 | Owner + Tech |
| D-09 | QR model | Static bearer token vs. rotating signed QR | Static for MVP (T-04 accepted) | Tech |
| D-10 | Behaviour when offline | No stamping vs. queued stamps | No stamping in MVP | Owner |
| D-11 | Legal/tax: VAT and fiscal-register treatment of free reward coffees; *regulamin* review | — | **Ask an accountant/legal advisor before launch.** The engineering assumption is that redemptions are recorded on the fiscal register by staff as the owner's accountant instructs; the system only logs them. | Owner |
| D-12 | Accessibility-law applicability (EAA / Polish act) | — | Meet WCAG 2.2 AA anyway | Owner |
| D-13 | Technology stack & hosting | e.g. static site generator + serverless functions + managed Postgres, or a single small full-stack framework app on a low-cost PaaS | Decided in a separate ADR (`docs/adr/`) against NFR-O-01, NFR-P, BR-06/07 (transactional DB needed) | Tech |
| D-14 | Domain name & email | — | `[PLACEHOLDER: domain]` | Owner |
| D-15 | Brand assets | Existing identity vs. new design | `[PLACEHOLDER: logo, fonts, colours, photography]` | Owner |
| D-16 | Analytics | None / cookieless privacy-friendly tool | Cookieless, self-hosted or EU-hosted | Owner + Tech |

---

## 12. Placeholder register

All the content that has to come from the owner before launch (see AC-REL-01):

- **Business:** legal company name, NIP, registered address, contact email/phone, social links, domain.
- **Location:** street address, GPS coordinates, tram stop name and lines, wayfinding description, static map image.
- **Hours:** weekly opening hours, holiday exceptions.
- **Menu:** full item list per category, sizes, gross PLN prices, descriptions (PL/EN), allergens, seasonal/availability flags.
- **Brand:** logo (SVG), brand colours, typography (licensed for web self-hosting), hero and product photography, favicon/app icons, Open Graph image.
- **Loyalty:** reward eligibility, per-transaction cap, cooldown, void window, empty-card purge period, inactive-card retention, reward expiry policy.
- **Operations:** monthly budget, staff device model(s), fiscal register model, number of staff accounts.
- **Legal:** privacy policy text, loyalty *regulamin*, accountant guidance on D-11.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Card** | An anonymous loyalty record identified by a secret token. Shown as a QR on the customer's phone or on a printed card. |
| **Token** | A ≥ 128-bit random secret in the card URL. Whoever holds it controls the card (bearer credential). |
| **Card code** | A short, typable alias of the card used for manual staff lookup. Only accepted from authenticated staff. |
| **Stamp** | One loyalty credit for one qualifying purchase. |
| **Reward** | The right to one free coffee, earned per 6 stamps. |
| **Event** | An immutable ledger entry: stamp, redeem, void, adjust, block/unblock. |
| **Idempotency key** | A unique ID generated by the client per confirm action. The server applies a given key at most once. |
| **Void window** | The time after an action during which the cashier who made it can undo it themselves. |
| ***Regulamin*** | The Polish term for the formal terms and conditions of the loyalty programme. |
