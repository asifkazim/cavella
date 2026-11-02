# Cavella — user guide

How customers, cashiers and the owner use Cavella, and how to run it locally.
Checked against the running application on 2026-11-02 (branch `fix/release-review`).

> **Passwords are not in this file.** Local accounts and their passwords live in
> `apps/api/.env`, which is git-ignored. Never commit credentials (CLAUDE.md).

**Contents**

1. [Who does what](#1-who-does-what)
2. [Running it locally](#2-running-it-locally)
3. [Customer guide](#3-customer-guide)
4. [Cashier guide](#4-cashier-guide)
5. [Owner guide](#5-owner-guide)
6. [Rules and limits](#6-rules-and-limits)
7. [Troubleshooting](#7-troubleshooting)
8. [Not built yet](#8-not-built-yet)

---

## 1. Who does what

| Role | Signs in? | Uses | Can |
|---|---|---|---|
| **Customer** | No. No account, no personal data | The website on their phone: `/pl/card/` (or `/en/card/`) | Get a card, show its QR code, see stamps and free coffees, save a copy |
| **Cashier** (`CASHIER`) | Yes, own email + password | Staff console: `/pl/staff/` | Scan or type a card, add stamps (max 3 per order), give a free coffee |
| **Owner** (`OWNER`) | Yes, own email + password | Staff console, plus the admin API | Everything a cashier can, plus read the audit trail of any card |

The server is the only authority: every rule below is checked by the API, whatever the screen shows.
The website is in **Polish** (default) and **English**; switch with the language switcher in the header.
Screen labels below are given as **Polish** (English).

---

## 2. Running it locally

### Addresses

| What | URL |
|---|---|
| Website (preview of the production build) | http://localhost:4173/pl/ |
| Customer card | http://localhost:4173/pl/card/ |
| Staff console | http://localhost:4173/pl/staff/ — not linked from the public site on purpose |
| API | http://localhost:8080/api/v1/… |
| Database | PostgreSQL in Docker container `cavella-dev-db`, port 55432, database `cavella` |

`npm run dev` serves the same site at http://localhost:3000/pl/ with hot reload.

### Accounts

| Account | Email | Password |
|---|---|---|
| Owner | value of `CAVELLA_BOOTSTRAP_OWNER_EMAIL` in `apps/api/.env` (`owner@cavella.local`) | `CAVELLA_BOOTSTRAP_OWNER_PASSWORD` in the same file |
| Cashier | `DEV_CASHIER_EMAIL` in `apps/api/.env` (`cashier@cavella.local`) | `DEV_CASHIER_PASSWORD` in the same file |
| Customer | none — customers never sign in | — |

The owner is created automatically on the API's first start from the two `CAVELLA_BOOTSTRAP_OWNER_*`
variables, only if no owner exists yet. Remove them from the environment once it exists. The
cashier was created by hand (see [5.3](#53-managing-staff-accounts-interim-database-runbook)).

### Start

```bash
# 1. Database
docker start cavella-dev-db

# 2. API (JDK 21). From apps/api:
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot"
./mvnw -q -DskipTests package
set -a && . ./.env && set +a
java -jar target/cavella-api-0.1.0-SNAPSHOT.jar      # ready when the log says "Started CavellaApplication"

# 3. Website. From apps/web (Node ≥ 24):
npm ci            # first time only
npm run build     # static export to out/ (stop the preview first on Windows)
npm run preview   # http://localhost:4173
```

The website talks to `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`), baked in at build
time. The API only accepts browser calls from `CAVELLA_CORS_ALLOWED_ORIGINS`
(`http://localhost:3000,http://localhost:4173` locally).

### Stop

Stop the API and preview with Ctrl+C (or end their processes), then `docker stop cavella-dev-db`.

### Checks

```bash
# API (from apps/api): unit + integration tests (Docker needed)
./mvnw verify
# Website (from apps/web)
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
# Real browser against the real API, with the cashier account:
E2E_FULLSTACK=1 E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… npx playwright test loyalty-fullstack
```

---

## 3. Customer guide

The card lives **only on the customer's phone**, in the browser. There is no account, so nobody —
not even the owner — can restore a lost card. Every 6 stamps give 1 free coffee.

### 3.1 Get a card

1. Open **Karta** (Loyalty card) in the site menu, or scan the "Get your card" QR code at the kiosk.
2. Tap **Załóż kartę** (Get my card).
3. The card appears at once: a QR code, the **Kod karty** (Card code) under it, and **0 of 6 stamps**.

A phone can create at most 5 cards per hour from one internet connection; above that the page says
*"Too many attempts. Please try again in a moment."*

### 3.2 Collect stamps and free coffees

1. At the counter, open the card (bookmark, home-screen icon, or **Karta** in the menu).
2. Show **Pokaż ten kod przy kasie** (Show this code at the counter) — the QR code — to the cashier.
3. The cashier adds a stamp per coffee. The page refreshes by itself every 15 seconds while it is
   open, when you come back to it, and on **Odśwież** (Refresh).
4. On the 6th stamp the counter goes back to 0 and **Free coffees ready: 1** appears.
   Free coffees add up if you don't use them.
5. To use one, tell the cashier when ordering; they give it from their screen.

The stamp count is also written out for screen readers: *"4 of 6 stamps, 2 more to a free coffee"*.

### 3.3 Save a copy — do this once

Under **Zapisz kartę** (Save your card):

- **Zapisz obraz karty** (Save card image) — a PNG with your QR code, for your photo gallery or print.
- **Wyślij sobie link** (Send the link to yourself) / **Kopiuj link do karty** (Copy card link) — the
  card link `…/c#<code>`.

> ⚠️ Anyone with this link or QR code can use your card. Don't post it publicly.

### 3.4 Get the card back (new phone, cleared browser)

- Scan the saved QR image with the new phone's camera — the card opens in the browser and is stored
  on that phone; or
- open the saved card link.

Opening the link stores the card and removes the code from the address bar and history straight away.

If the phone already holds a **different** card, the page asks **Przełącz na nową kartę** (Switch to
the new card) or **Zostaw obecną kartę** (Keep the current card). Switching removes the old card from
this phone — save a copy of it first if you want to keep it.

### 3.5 Messages you may see

| Message | Meaning / what to do |
|---|---|
| *No connection. Showing the last saved status — it may be out of date.* | Offline. The QR code still works at the counter. |
| *We could not refresh your card. The QR code still works.* | The server didn't answer properly. Tap **Try again** later. Your card is fine. |
| *This browser does not allow saving the card (e.g. private mode).* | Private mode: the card disappears when you close the tab. Save the card image now. |
| **Nie znaleźliśmy tej karty** (We could not find this card) | The server says this card does not exist (e.g. removed after a long time unused). **Usuń kartę z tego urządzenia** (Remove card from this device) asks again before removing; choose **Zostaw kartę** (Keep the card) if unsure. |

### 3.6 Privacy

No name, email or phone number is collected. The card code is sent only to the Cavella server, in a
request header — never in a web address, analytics or logs. The server stores only a fingerprint
(SHA-256) of the code.

---

## 4. Cashier guide

Use a phone with a rear camera. The console is at `/pl/staff/` (bookmark it; it is not in the site
menu). Each person has their **own** account — never share a login: every stamp is recorded under
the account that gave it.

### 4.1 Sign in and out

1. Open `/pl/staff/` → **Logowanie obsługi** (Staff sign-in).
2. Enter **E-mail** and **Hasło** (Password) → **Zaloguj** (Sign in).
3. The top shows *Signed in: cashier*. **Wyloguj** (Sign out) ends the session.

- A session lasts **one shift: 12 hours from sign-in**, however busy you are. After that the console
  asks you to sign in again.
- **5 wrong passwords** lock the account for **15 minutes** (*"Account temporarily locked…"*).
- If the owner deactivates your account, the console signs you out on your next action.

### 4.2 Find the customer's card

**Scan:** **Zeskanuj kartę klienta** (Scan the customer's card) → **Włącz aparat** (Start camera) →
point the camera at the customer's QR code. It reads continuously. In poor light use
**Włącz latarkę** (Turn torch on), where the phone supports it. A QR code from any other site shows
*"That is not a Cavella card."* and is ignored.

**Type the code** (QR won't scan, camera denied): **Wpisz kod karty** (Type the card code) → type the
**Kod karty** shown under the customer's QR code → **Znajdź kartę** (Find card).
The code has 22 characters (letters, digits, `-`, `_`); **letters are case-sensitive**, spaces optional.

> The camera needs HTTPS (or `localhost`). Opening the console on a phone over plain
> `http://<computer-ip>` blocks the camera; use manual entry there.

### 4.3 The card screen

**Karta klienta** (Customer card) shows stamps *n / 6*, **free coffees**, and *Last visit: …* (or
*New card*). A blocked card shows *"Card blocked — stamps and rewards are not allowed."* and no
buttons.

#### Add stamps — one per paid coffee

1. Set **Liczba kaw w tym zamówieniu** (Coffees in this order) with **−** / **+** (1–3).
2. Tap **Dodaj pieczątki** (Add stamps), then **Potwierdź: +N** (Confirm: +N) — nothing is saved
   before Confirm. **Anuluj** (Cancel) sends nothing.
3. Success: *"Stamps added: N."* — on the 6th stamp also *"The customer earned a free coffee!"*.

#### Give a free coffee

1. **Wydaj kawę gratis** (Give free coffee) — only active when the customer has one.
2. **Wydać 1 kawę gratis?** (Give 1 free coffee?) → **Tak, wydaj** (Yes, give it), or **Anuluj**.
3. Success: *"Free coffee given."* One confirm = exactly one free coffee.

You may stamp the 6th coffee and then give the free coffee in the same visit — as two separate
confirmed actions.

#### Next customer

**Następna karta** (Next card) goes back to scanning.

### 4.4 When something goes wrong

**The golden rule:** if the screen says the result is *unknown*, tap **Spróbuj ponownie** (Try again)
— never rescan and stamp again. A retry is always safe: the server recognises it and never records
it twice (*"This was already recorded — nothing was duplicated."*).

| Message | What happened | What to do |
|---|---|---|
| *No answer from the server — it may or may not have been saved.* | Network dropped or timed out; the stamp may already be saved | **Try again** until it succeeds. Other buttons stay locked until then. |
| *The last action may already have been saved…* (after **Next card**) | You tried to move on with an unknown result | **Zostań** (Stay) and retry. **Mimo to przejdź dalej** (Move on anyway) only if the network is down for good — then tell the owner. |
| *Your session expired during this action. Try again to finish it.* | Shift session ended mid-action; you signed in again | **Try again** — it finishes the same action safely. |
| *Your session expired. Please sign in again.* | 12-hour session over | Sign in. |
| *The customer has no free coffee to redeem.* | Already used (maybe at another till) | Nothing to give. |
| *Too many stamps in one transaction.* | More than 3 at once | Max 3 per order. |
| *This card is blocked.* | Owner blocked the card | No stamps or rewards; refer to the owner. |
| *Card not found.* | Wrong code, or not a Cavella card | Rescan or retype carefully (case matters). |
| *Too many attempts. Wait a moment.* | Rate limit | Wait a minute. |
| *Wrong email or password.* / *Account temporarily locked…* | Sign-in failed | Check details / wait 15 min or ask the owner. |

**No connection at all:** stamps can't be added offline. Tell the customer it can't be added right now.

---

## 5. Owner guide

### 5.1 Daily use

Sign in to the staff console exactly like a cashier (*Signed in: owner*). Everything in
[section 4](#4-cashier-guide) applies.

### 5.2 Audit trail of a card

Every stamp and free coffee is recorded permanently — who, what, when, with the balance after it.
Records can't be edited or deleted (the database refuses). There is **no admin screen yet**; read it
from the API with an owner session:

```bash
A=http://localhost:8080/api/v1; O="Origin: http://localhost:4173"; set -a; . apps/api/.env; set +a
CSRF=$(curl -s -c owner.jar -b owner.jar -H "$O" $A/staff/auth/csrf | sed -E 's/.*"token":"([^"]*)".*/\1/')
curl -s -c owner.jar -b owner.jar -H "$O" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$CAVELLA_BOOTSTRAP_OWNER_EMAIL\",\"password\":\"$CAVELLA_BOOTSTRAP_OWNER_PASSWORD\"}" \
  $A/staff/auth/login >/dev/null
curl -s -b owner.jar -H "$O" $A/admin/cards/<cardId>/events      # cardId: from the staff card lookup
rm owner.jar
```

Each entry: `type` (`STAMP` / `REDEEM`), `quantity` (stamps given / 1 free coffee), `stampsAfter`,
`rewardsAfter`, `staffId`, `idempotencyKey`, `createdAt` (UTC). Note: `stampDelta` is the change of the
progress counter, so the stamp that completes a reward shows a negative delta (e.g. 3 → 0 = −3) with
`rewardDelta` +1. Cashiers calling this endpoint get `403 FORBIDDEN`.

### 5.3 Managing staff accounts (interim database runbook)

Until the admin screens exist (finding H1 in `docs/RELEASE-REVIEW.md`), staff are managed directly
in the database. Open a SQL shell:

```bash
docker exec -it cavella-dev-db psql -U cavella -d cavella
```

**Add a cashier.** Generate a bcrypt hash (cost 12, `{bcrypt}` prefix) — e.g. with Spring Security's
encoder in `jshell`, using `spring-security-crypto` and `commons-logging` from `~/.m2`:

```java
new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(12).encode("<new password>")
// store as "{bcrypt}" + result
```

```sql
INSERT INTO staff_user (id, email, display_name, role, password_hash)
VALUES (gen_random_uuid(), 'anna@example.pl', 'Anna', 'CASHIER', '{bcrypt}$2a$12$…');
```

Use passwords of 12+ characters, one account per person, and hand them over in person.

| Task | SQL | Effect |
|---|---|---|
| Deactivate (left the job, lost phone) | `UPDATE staff_user SET active = false WHERE email = '…';` | All their sessions end on their next request |
| Reactivate | `UPDATE staff_user SET active = true WHERE email = '…';` | Can sign in again |
| Unlock after 5 wrong passwords | `UPDATE staff_user SET failed_login_count = 0, locked_until = NULL WHERE email = '…';` | Can sign in now |
| Reset password | `UPDATE staff_user SET password_hash = '{bcrypt}…' WHERE email = '…';` | Old password stops working |
| Make someone owner | `UPDATE staff_user SET role = 'OWNER' WHERE email = '…';` | Takes effect at their next sign-in |
| Block a card (suspected fraud) | `UPDATE card SET status = 'BLOCKED' WHERE id = '<cardId>';` | No stamps or rewards; staff see *Card blocked* |
| Unblock | `UPDATE card SET status = 'ACTIVE' WHERE id = '<cardId>';` | Normal again |

Never `UPDATE` or `DELETE` rows in `loyalty_event` — it is the audit log and the database rejects it.
A wrong stamp can't be undone yet (see [section 8](#8-not-built-yet)).

### 5.4 Website content

Menu, prices, opening hours, address and contact details live in `apps/web/src/content/`
(`menu.ts`, `hours.ts`, `location.ts`, `business.ts`). Anything still unknown shows as a visible
**placeholder** on the site and must be filled in before launch. Rebuild the site after editing.

---

## 6. Rules and limits

| Rule | Value | Where set |
|---|---|---|
| Stamps per free coffee | 6 (extra stamps carry over) | `LoyaltyRules.DEFAULT` |
| Stamps per transaction | 1–3 | `LoyaltyRules.DEFAULT` (placeholder, PRD FR-S-06) |
| Free coffees | Accumulate; redeemed one per confirm; never below 0 | Server + database constraint |
| Retry safety | Same request retried = recorded once | `Idempotency-Key` per confirmed action |
| Staff session | 12 h from sign-in (absolute); 12 h idle | `cavella.session.max-lifetime`, `spring.session.timeout` |
| Sign-in lockout | 5 wrong passwords → 15 min | `StaffAuthenticationService` |
| New cards | 5 per hour per connection | `cavella.rate-limit.card-creations-per-hour` |
| Card balance reads | 60 per minute per connection | `cavella.rate-limit.card-reads-per-minute` |
| Sign-in attempts | 20 per minute per connection | `cavella.rate-limit.login-attempts-per-minute` |
| Time zone | Stored in UTC; shown in Europe/Warsaw | — |

---

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Website shows offline / can't create a card | Is the API running (`curl http://localhost:8080/api/v1/staff/auth/csrf`)? Is the site's origin in `CAVELLA_CORS_ALLOWED_ORIGINS`? |
| Staff sign-in loops back to the form locally | Run the API with `SPRING_PROFILES_ACTIVE=dev` (relaxed cookie for plain http). |
| API won't start: datasource error | `docker start cavella-dev-db`; `SPRING_DATASOURCE_*` set from `apps/api/.env`. |
| `./mvnw verify` fails renaming the jar | The API is running from that jar — stop it first. |
| `npm run build` fails on Windows | Stop `npm run preview` first (it locks `out/`). |
| Tests can't pull Docker images | `docker logout` / log in again; or use the local image: `-Dcavella.test.postgres-image=postgres:16-alpine` with `TESTCONTAINERS_RYUK_DISABLED=true`. |
| Camera doesn't start on a phone | Needs HTTPS (or localhost) and camera permission; use manual code entry meanwhile. |

---

## 8. Not built yet

From `docs/RELEASE-REVIEW.md` and the PRD — plan around these:

- **Undo / void / correction** of a stamp or free coffee (FR-S-08, FR-A-04) — mistakes stay in the balance.
- **Admin screens**: staff accounts, card blocking, remote sign-out, daily reports, CSV export,
  anomaly flags (FR-A-01, -03, -05, -06). Use the runbook in 5.3 meanwhile.
- **Short card codes** (ADR-002): the code under the QR is currently the full secret; read it out only
  at the counter, quietly.
- **Stamp cooldown and cashier warnings** (BR-09, FR-S-05).
- **Owner two-factor sign-in and idle PIN lock** (APR-07).
- **Physical pre-printed cards**, wallet passes, shift summary.
- **Production infrastructure**: hosting, HTTPS headers, backups, purge jobs (`infra/` not created).
