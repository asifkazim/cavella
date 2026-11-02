# Pre-release review findings (2026-11-02)

Independent review of the implementation against `PRD.md`, `ARCHITECTURE.md` and `ADR/`.
Fixed one at a time; each fix lists its tests. Status: ☐ open · ◐ in progress · ☑ fixed.

## High

| ID | Status | Finding | Where |
|---|---|---|---|
| H1 | ☐ | Staff management, undo (FR-S-08), owner void (FR-A-04), adjustments and session revocation don't exist. Cashiers can't get their own accounts and mistakes can't be corrected. | `staff/application/StaffBootstrap.java:561` is the only account creation path |
| H2 | ☑ | Staff UI says "nothing was saved" after a network error or timeout, although the server may have committed. The cashier moves on and stamps or redeems again with a new idempotency key. **Fixed:** an unknown outcome is shown as unknown; new actions are locked until a retry with the same key; "Next card" asks first. Tests: `action-machine.test.ts`, `messages.test.ts`, E2E `loyalty-staff.spec.ts` (new `lostResponse` fault). | `i18n/dictionaries/en.ts:146`, `pl.ts:144`, `lib/api/client.ts:73,81`, `components/staff/CardActionsPanel.tsx:178` |

## Medium

| ID | Status | Finding | Where |
|---|---|---|---|
| M1 | ☑ | Staff sessions only have a sliding 12 h idle timeout, so a session that's used regularly never expires (FR-S-02). **Fixed:** the login time is stored in the session (injected `Clock`), and `ActiveStaffFilter` destroys the session 12 h after login (`cavella.session.max-lifetime`); a session without a login time fails closed. Tests: `StaffSessionLifetimeTest`, `StaffSessionLifetimeIT` (new `support/MutableClock`). | `application.yaml:25` |
| M2 | ☑ | Rate limiter: full IPv6 addresses as keys (easy bypass), a 50k-entry scan on every request once full, and a prune that uses the caller's window (resets hourly limits). **Fixed:** IPv6 keyed by /64 (`ClientAddress`); each window stores its own end; cleanup only when full and at most every 10 s; when still full, new clients share an overflow window per bucket. No new dependency. Tests: `RateLimiterTest`, `ClientAddressTest`. | `shared/web/RateLimiter.java:254-257` |
| M3 | ☐ | Client IP is wrong behind Cloudflare unless Caddy is set up for it. 5 cards/hour per IP also blocks real customers behind CGNAT or shared Wi-Fi. | `application.yaml:40,58`, missing `infra/` |
| M4 | ☑ | Any 404 (wrong API URL, proxy error) is shown as "card not found", with a one-tap, unconfirmed button that removes the only copy of the card. **Fixed:** only the `CARD_NOT_FOUND` code counts as a missing card (`lib/loyalty/card-issue.ts`); removal needs a confirmation that focuses "Keep the card"; a failed refresh now says so, with a retry, instead of "could not create your card". Tests: `card-issue.test.ts`, E2E `loyalty-customer.spec.ts`. | `hooks/useCustomerCard.ts:25`, `components/loyalty/CustomerCardApp.tsx:110` |
| M5 | ☐ | The "card code" is the full bearer token, read aloud at the counter. The ADR-002 short code isn't built. | `CustomerCardApp.tsx:124`, `lib/loyalty/card-token.ts` |
| M6 | ☐ | No BR-09 cooldown, no FR-S-05 warnings, no per-cashier report, so T-05 (dishonest cashier) goes undetected. | `loyalty/application/LoyaltyService.java:201-205` |
| M7 | ☐ | Missing infrastructure: no backups (SEC-06), no `_headers` (CSP/HSTS/Referrer-Policy), no purge jobs for idempotency records and empty cards. | `infra/` missing, `apps/web/public/` |

## Low

| ID | Status | Finding | Where |
|---|---|---|---|
| L1 | ☐ | `423 ACCOUNT_LOCKED` reveals which emails exist; anyone can keep the owner locked out. | `staff/application/StaffAuthenticationService.java:490-491` |
| L2 | ☑ | Anonymous `GET /staff/auth/csrf` creates a 12 h session row with no rate limit. **Fixed:** rate-limited per IP (`csrf-tokens-per-minute: 30`) before any session is written; a pre-login session gets a 10 min idle timeout (`cavella.session.anonymous-timeout`), and login restores the 12 h staff timeout. Tests: `CsrfSessionApiIT`, `StaffSessionLifetimeTest`. | `config/WebSecurityConfig.java:171`, `staff/web/StaffAuthController.java:388` |
| L3 | ☑ | A lock timeout returns 500 `INTERNAL_ERROR` instead of 503 (ARCHITECTURE §9.3). **Fixed:** transient database failures (lock/statement timeout, deadlock, serialization; by Spring type or SQLState, since Spring leaves 55P03 uncategorised) return 503 `SERVICE_UNAVAILABLE` + `Retry-After: 1`, logged as a one-line warning. Tests: `TransientDatabaseFailuresTest`, `LockTimeoutApiIT` (real row lock). | `shared/web/ApiExceptionHandler.java:79` |
| L4 | ☑ | The 5 s `statement_timeout` also applies to Flyway migrations. **Fixed:** Flyway connections run with `statement_timeout = 0` and `lock_timeout = 30s` (`spring.flyway.init-sqls`); `MigrationConfig` evicts the pool's connections after migrating so app connections get their timeouts back. Note: the other ITs use `@ServiceConnection`, which gives Flyway a separate DataSource and hides this, so `MigrationTimeoutsIT` is wired like production. | `application.yaml:21` |
| L5 | ☑ | Session expiry during a retry throws away the unresolved action and its idempotency key. **Fixed:** the interrupted action is kept with the staff id and card (`lib/staff/pending-action.ts`) and, after the *same* cashier signs in again, resumes retry-only with its original key; another cashier starts from scanning. Tests: `pending-action.test.ts`, `action-machine.test.ts`, `messages.test.ts`, E2E `loyalty-staff.spec.ts`. | `CardActionsPanel.tsx:73-75`, `StaffApp.tsx:55-56` |
| L6 | ☑ | The redeem `alertdialog` doesn't move focus into itself (screen readers). **Fixed:** focus moves to "Cancel" when it opens, back to "Redeem" on cancel, and onto the outcome message after any stamp or redemption. Test: E2E keyboard journey in `loyalty-staff.spec.ts`. | `CardActionsPanel.tsx:141` |
| L7 | ☐ | CLAUDE.md requires a green Spring Modulith `verify()` test, but there is no Modulith dependency or test, so module boundaries aren't checked. (Found while fixing L3.) | `apps/api/pom.xml`, `src/test` |
