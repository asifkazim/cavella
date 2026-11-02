# ADR-001: Technology stack and deployment shape

| | |
|---|---|
| **Status** | **Proposed**, awaiting owner approval (see APR-01, APR-02, APR-08, APR-09 in [ARCHITECTURE.md §0](../ARCHITECTURE.md#0-decisions-requiring-your-approval)) |
| **Date** | 2026-11-01 |
| **Deciders** | Owner (`[PLACEHOLDER: name]`), principal architect |
| **Related** | [PRD](../PRD.md) · [ARCHITECTURE](../ARCHITECTURE.md) · [ADR-002](002-loyalty-card-identity.md) |

## Context

Cavella needs:
- a very fast, mostly static, bilingual public website (NFR-P-01–04),
- an anonymous loyalty card page,
- a camera-based staff app,
- a small admin area,
- a backend that must **guarantee** no double redemption and no unauthorised stamps (BR-01, BR-05, BR-06).

Volume is tiny (A-11: ≤ 2k cards, ≤ 500 events/day), the budget is about 100 PLN/month (G4), and a very small team will maintain it.

The owner's preferred technologies are Next.js, TypeScript and Tailwind CSS; Java 21 and Spring Boot; PostgreSQL and Flyway; Docker Compose; JUnit 5, Testcontainers and Playwright. Microservices, Kafka, Redis and Kubernetes are excluded unless a requirement demonstrates the need.

### Decision drivers
1. **Correctness of loyalty transactions** (ACID, row locks, DB constraints).
2. **Public-site speed and resilience** (CDN, works when the backend is down, NFR-R-03).
3. **Low running cost and ops effort.**
4. **Familiarity** with the preferred stack.
5. **Testability** of concurrency and end-to-end camera flows.

## Options considered

### Option A: Next.js static export + Spring Boot modular monolith + PostgreSQL *(chosen)*
- Frontend: Next.js (App Router, TypeScript, Tailwind) built with `output: 'export'` and served from Cloudflare Pages. The card, staff and admin areas are client-side.
- Backend: one Spring Boot application (Java 21) organised as Spring Modulith modules (`card`, `loyalty`, `staff`, `reporting`, `shared`), exposing a JSON REST API.
- Data: PostgreSQL 17, with schema managed by Flyway.
- Runtime: Docker Compose on one EU VPS (Caddy, API, Postgres, backup sidecar).

➕ Matches the preferred stack. Postgres + Spring `@Transactional` + row locks give the strongest, simplest correctness story. The public site is on a CDN and independent of the backend. Testcontainers lets real Postgres concurrency tests run in CI. Clear module boundaries without distributed-systems cost.
➖ Two languages and runtimes (TypeScript, Java). The cross-origin setup (web on `<domain>`, API on `api.<domain>`) needs CORS plus a same-site cookie. The JVM needs ~300–500 MB RAM and ~10–20 s to start, so a VPS is preferred over a scale-to-zero PaaS.

### Option B: Next.js full-stack only (Route Handlers / Server Actions + Postgres via an ORM)
➕ One language and runtime, one deploy, no CORS. The cheapest to build for a TypeScript-only team.
➖ Not the preferred backend stack. Transactional, row-lock-heavy domain code and DB-level concurrency testing are less mature in the TS ORM ecosystem than in Spring + JDBC/JPA + Testcontainers. Mixing the public site and the API in one server process loses "the site survives a backend outage" unless it is split anyway. **This is a genuinely viable, simpler alternative.** It was rejected mainly on stack preference and transactional rigour, not because it can't meet the requirements.

### Option C: Spring Boot server-rendered (Thymeleaf + htmx), no Node build
➕ One runtime and one deployable. Simple same-origin auth.
➖ Gives up Next.js (preferred). The public site would be served by the JVM rather than a CDN, so it goes down with the backend and is harder to get to Lighthouse 95+ consistently. Weaker fit for the rich client-side camera scanner and offline card shell.

### Deployment sub-options
Compared in detail in [ARCHITECTURE §11.2](../ARCHITECTURE.md#112-alternatives-compared):
1. Pages + VPS *(chosen)*.
2. Everything on the VPS.
3. Managed PaaS + managed Postgres.

## Decision

**Adopt Option A**, with the following specifics:

| Area | Choice | Notes |
|---|---|---|
| Frontend framework | **Next.js** (current stable major), App Router, **static export** | **[APR-02]** No SSR, no Next API routes, no middleware |
| Language / styling | **TypeScript** (strict), **Tailwind CSS** (current major) | Self-hosted fonts (NFR-C-03) |
| Frontend libs (indicative) | A small QR *generator*; a QR *decoder* (native `BarcodeDetector` + WASM zxing fallback); a minimal service worker | Final picks made in an implementation spike against AC-S-01 |
| Backend | **Java 21 LTS**, **Spring Boot** (current GA line at implementation time), Spring Web MVC, Spring Security, Spring Session JDBC, Spring Data JDBC or JPA, **Spring Modulith** | Virtual threads may be enabled (`spring.threads.virtual.enabled`), but they aren't needed at this load |
| API errors | RFC 9457 Problem Details (Spring `ProblemDetail`) | See ARCHITECTURE §5.3 |
| Database | **PostgreSQL 17** | Single instance. `citext`, `pgcrypto` only if needed |
| Migrations | **Flyway**, run at application startup | Forward-only, expand/contract |
| Build | **Maven** (wrapper committed) | **[APR-08]** Gradle is an acceptable alternative |
| Testing | **JUnit Jupiter**, **Testcontainers** (PostgreSQL module), Spring Modulith tests, **Playwright** (+ `@axe-core/playwright`), Lighthouse CI | **[APR-08] resolved 2026-11-02:** Spring Boot 4.1.1 (Spring Framework 7) manages **JUnit Jupiter 6.0.3**, and Spring's test support requires Jupiter 6, so pinning JUnit 5 is not possible on a supported Boot line. Tests use the same Jupiter programming model (`@Test`, `@ParameterizedTest`, `@Nested`). Testcontainers is 2.0.5 (Boot-managed) |
| Containers | **Docker Compose** for local, staging and production | No Kubernetes |
| Reverse proxy / TLS | **Caddy** (automatic certificates) behind the Cloudflare proxy | |
| Hosting | **Cloudflare Pages** (web) + **one EU VPS** (API + DB) | **[APR-01]** |
| Backups | `pg_dump` → `age` encryption → `rclone` to EU object storage, nightly | **[APR-10]** RPO 24 h |
| Error tracking | **Sentry** free tier, EU data region, scrubbing on | **[APR-09]** |
| CI/CD | GitHub Actions; images on GHCR | |
| Rate limiting | Bucket4j in-memory + Cloudflare rules | Single instance (ARCHITECTURE §10.2) |

**Version policy:** pin exact versions for every runtime, library and container image (images pinned by digest in production). Only adopt releases that are at least 2 weeks old. Renovate or Dependabot opens monthly update PRs, and CI must pass before they merge.

**Explicitly rejected for now:** microservices, Kafka or any message broker, Redis, Kubernetes, GraphQL, JWT-based staff auth, an event-sourcing framework (Axon etc.), GraalVM native images. Each adds operational or conceptual cost with no requirement driving it. The triggers for revisiting are listed in ARCHITECTURE §11.7.

## Consequences

**Positive**
- Strong, testable transactional guarantees for the loyalty core.
- The public site is fast and independent of the backend's health.
- About €8–13/month total. Every component runs locally with `docker compose up`.
- Module boundaries let us extract or replace parts later (for example a `content` module or a POS adapter) without a rewrite.

**Negative / costs accepted**
- Two toolchains (Node and JVM) in CI and for developers.
- CORS and a same-site cookie setup between `<domain>` and `api.<domain>`. This must be tested in Safari and Chrome early.
- Content edits (menu, prices, hours) need a commit and a Pages redeploy in the MVP (PRD D-08a).
- We own VPS patching, backups and restore drills (runbooks required before launch).
- JVM restarts cause ~10–20 s of API unavailability per deploy. Mitigated by idempotent retries and off-peak deploys.

**Follow-ups**
1. Spike: QR decode library performance on reference devices (AC-S-01).
2. Spike: iOS home-screen card behaviour (ADR-002).
3. Choose the VPS provider and region, and the object-storage provider (APR-01).
4. Write runbooks: deploy, restore, secret rotation, staff onboarding.
