# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cavella is a coffee kiosk's public website and anonymous QR loyalty system (6 stamps → 1 free coffee). Source of truth:
- **What:** [`docs/PRD.md`](docs/PRD.md). Requirement IDs `FR-`, `BR-`, `NFR-`, `AC-`, `T-`, `E-`, `D-`.
- **How:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) plus [`docs/ADR/`](docs/ADR/). Approval items are `APR-nn` in ARCHITECTURE §0.

Follow the architecture. If a change contradicts it, or depends on an unapproved `APR-`/`D-` item, stop and ask. Don't silently pick an option. Architectural changes need a new ADR in `docs/ADR/NNN-title.md`.

## Status

- `apps/web`: public website (home, menu, location/hours) plus loyalty UI, all in PL + EN:
  - Customer card at `/[locale]/card/`. QR links land on `/c#token`, which stores the token on the device and strips it from the URL.
  - Staff console at `/[locale]/staff/`: camera scanner, manual code entry, confirmed stamps and redemptions.
  - The API URL comes from `NEXT_PUBLIC_API_BASE_URL` (see `apps/web/.env.example`).
- `apps/api`: loyalty backend implemented: card issuance and retrieval, staff session auth, stamps and redemptions, idempotency, audit trail, REST API. Not built yet: short codes, VOID/ADJUST, admin staff management, owner TOTP and idle PIN (APR-07).
- `infra/`: **not created yet.** Its commands below are targets; verify before relying on them.

## Layout

```
apps/web/   Next.js 16 + TS + Tailwind 4, static export (output: 'export') → Cloudflare Pages
  src/app/[locale]/    pages (pl, en); src/app/(root)/ redirects / → /pl/; global-not-found.tsx = 404
  src/content/         owner-editable content: menu, hours, location, business ([PLACEHOLDER]s live here)
  src/lib/             pure logic (hours, formatting, maps, scrollspy) with Vitest tests next to it
  src/i18n/            dictionaries (en.ts is typed against pl.ts)
  src/components/      presentational components; client components only where interaction needs it
  e2e/                 Playwright + axe specs, static-server.mjs (serves out/)
apps/api/   (target) Spring Boot (Java 21, Maven), package pl.cavella.{card,loyalty,staff,reporting,shared}
infra/      (target) compose.yaml, compose.prod.yaml, Caddyfile, runbooks/
docs/       PRD, ARCHITECTURE, ADR/, ASSETS (asset licence register)
```

## Commands

Web (from `apps/web`, Node ≥ 24):

```bash
npm ci
npm run dev                                   # http://localhost:3000/pl/
npm run lint && npm run typecheck && npm test # ESLint, tsc (after next typegen), Vitest
npx vitest run src/lib/hours.test.ts          # one unit test file (-t "name" for one test)
npm run build                                 # static export to out/
npm run preview                               # serve out/ at http://localhost:4173
npx playwright install chromium               # once per machine
npm run test:e2e                              # Playwright + axe against out/ (build first)
npx playwright test e2e/site.spec.ts -g "language switch"   # one E2E test
E2E_FULLSTACK=1 E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… npx playwright test loyalty-fullstack   # against the real API on :8080 (dev profile)
```

Loyalty E2E specs use `e2e/support/fake-api.ts`, an in-browser fake of the API contracts with fault injection, and `fake-camera.ts`, which feeds a real QR image into `getUserMedia`. Never log, store in analytics, or put card tokens in URL paths or queries: they belong only in the `X-Card-Token` header, request bodies, and on-device storage.

On Windows, stop `npm run preview` before `npm run build` (the server locks `out/`).

API (from `apps/api`; needs JDK 21 as `JAVA_HOME`; integration tests need a running Docker daemon):

```bash
./mvnw test                                   # unit tests (*Test, Surefire): no Spring, no Docker
./mvnw verify                                 # + integration tests (*IT, Failsafe): Spring + PostgreSQL via Testcontainers
./mvnw test -Dtest='BalanceTest'              # one unit test class
./mvnw verify -Dtest=None -Dsurefire.failIfNoSpecifiedTests=false -Dit.test='ConcurrencyIT'   # one IT class
# Registry unreachable? use a local image: -Dcavella.test.postgres-image=postgres:16-alpine (+ TESTCONTAINERS_RYUK_DISABLED=true)
```

Run locally: set the variables from `apps/api/.env.example` (datasource, bootstrap owner) plus `SPRING_PROFILES_ACTIVE=dev`, then run `./mvnw spring-boot:run`. There are no credentials in the repo, so the app refuses to start without a datasource.

API layout: `pl.cavella.{card,loyalty,staff,shared}`, each with these layers:
- `domain/`: pure Java.
- `application/`: services with `@PreAuthorize` + `@Transactional`.
- `persistence/`: JdbcTemplate with explicit SQL.
- `web/`: controllers and DTOs.

`pl.cavella.config` holds security and session wiring. Errors go through `shared.web.Problems` (RFC 9457 + `code`), with one advice per module. The schema lives in `src/main/resources/db/migration`. Integration tests extend `support.IntegrationTest` (service level) or `support.ApiIntegrationTest` (MockMvc through the real filter chain).

Infra (target, not created yet): `docker compose -f infra/compose.yaml up -d postgres`.

## Architecture rules (non-negotiable)

- **The backend is the only authority** on balances, loyalty rules, identity and permissions. The web app renders, collects intent and retries. Client-side role checks are cosmetic.
- **Loyalty model** (ARCHITECTURE §8–§9):
  - The ledger is append-only (`loyalty_event`). The balance projection on `card` is updated in the **same transaction**, under `SELECT … FOR UPDATE` on the card row.
  - Never `UPDATE`/`DELETE` ledger rows. Corrections are `VOID`/`ADJUST` events.
  - A void that would make a balance negative is rejected.
- **Idempotency:** every staff loyalty write requires an `Idempotency-Key`, keyed by `(staff_user_id, key)` and stored in the same transaction. Retries reuse the same key.
- **Card token** (ADR-002):
  - 128-bit random, carried in the URL **fragment** `/c#<token>`, sent to the API only in the `X-Card-Token` header.
  - Never in a path, query string, log line, analytics event or error report. Only `SHA-256(token)` is stored.
  - Short codes are accepted only from authenticated staff.
- **Staff auth:**
  - Server-side sessions (Spring Session JDBC), plus CSRF and strict CORS.
  - `@PreAuthorize` on application services.
  - No JWTs.
- **Errors:** RFC 9457 Problem Details with a stable `code`. The web app maps `code` to localised UI text.
- **Time:** use the injected `Clock`, store `timestamptz` in UTC, and use Europe/Warsaw for day boundaries and opening hours.
- **No new infrastructure** (Redis, brokers, Kubernetes, microservices, an SSR server) without an ADR.

## Backend conventions (apps/api)

- Layers per module:
  - `web` (controllers + request/response DTOs)
  - `application` (use-case services, transactions, authorisation)
  - `domain` (pure logic, no Spring or JPA imports where practical)
  - `persistence` (repositories, entities)

  Controllers contain no business logic. Domain code never touches HTTP.
- Modules talk only through their public API package. The Spring Modulith `verify()` test must stay green.
- Use **records** for DTOs, commands, results, value objects and domain events.
- Validate all external input: Bean Validation on DTOs, plus domain invariants in `domain`. Reject unknown or oversized input.
- Schema changes are **Flyway migrations only** (`src/main/resources/db/migration/V{n}__{desc}.sql`).
  - Forward-only, expand/contract.
  - Never edit an applied migration.
  - Enforce invariants with DB constraints as well as in Java.

## Frontend conventions (apps/web)

- TypeScript `strict: true`. No `any` and no `@ts-ignore` without a comment explaining why.
- Business logic lives in plain TS modules (`lib/`), not in components: open-now calculation, QR payload parsing, API client, error-code mapping. Components stay presentational.
- Accessibility: WCAG 2.2 AA.
  - Semantic HTML, labelled controls.
  - Never convey status by colour alone.
  - Touch targets ≥ 44 px.
  - Respect `prefers-reduced-motion`.
- All UI strings go through i18n (PL primary, EN). No hardcoded copy.
- Business content (menu, prices, hours, address) lives in `content/`. Unknown values stay as `[PLACEHOLDER: …]`. Never invent prices, addresses or hours.
- Respect the performance budgets in NFR-P. No third-party embeds, trackers or runtime font loading. Note: the Next.js + React runtime alone is ~138 KB gzip, so the PRD's 70 KB JS budget is currently unmet and awaiting an owner decision. Don't add client JS casually.
- Server components by default. Add `'use client'` only for real interaction (nav toggle, live status, scroll spy). Time-dependent UI must use `useNow()` (`src/hooks/useNow.ts`), which renders a loading state in the static HTML.
- New visual assets must be recorded in `docs/ASSETS.md` with source and licence.

## Engineering rules

- **Tests:**
  - Every business rule and every bug fix gets a test. Bug fixes start with a failing test.
  - Concurrency and idempotency changes need a Testcontainers test (see AC-L-04/05).
  - **Never weaken, skip or delete a test to make it pass.** Fix the code, or raise the conflict.
- **Secrets:**
  - Never log card tokens, cookies, CSRF tokens, passwords, PINs or TOTP secrets.
  - Never hardcode credentials. Use environment variables or untracked `.env` files, and keep `.env.example` with dummy values.
- **Dependencies:** don't add one without stating why it's needed and why the existing stack can't do it. Pin exact versions, and only use releases at least 2 weeks old.
- Keep changes small and focused on the task. No drive-by refactors.
- Before finishing:
  - Run the relevant lint, typecheck, tests and build for every app you touched.
  - Report **files changed** and **checks run, with their results**. Say explicitly what was not run and why.
- **Do not commit, push, or deploy without explicit approval.** Main branch is `main`.
