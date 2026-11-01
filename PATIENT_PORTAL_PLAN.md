> **Status:** Phase 0 complete; key rotation moved to 8.1; Phase 1 complete (#69 server, #70 settings tab); Phase 2 complete (#72 slot engine, #73 public read API, `05226ec` `/book/[slug]` page); Phase 3 complete (3.1+3.2 OTP `54a6c2d`…`65677b7`, 3.3 session `8116ebc`, 3.4 "Mis citas" OTP login); next is Phase 4. **Updated:** 2026-11-01

## Phase 0 status (2026-10-26)
Built as the branches below, then merged to `staging` through PRs #59–#68 with review fixes. Server: 46 integration files / 558 tests against real Postgres, `tsc --noEmit` clean; Portal: ~200 unit tests; the self-contained Playwright `e2e` job runs in CI. CI triggers on pull requests and pushes to `main` (no longer on pushes to `staging`).

| Branch | Items | Notes |
|---|---|---|
| `phase0/a1-config-ci`, `a2-schema-prep` | 0.12, 0.13 | `ENABLE_PORTAL`, CI on `staging` + lint, `source`/`cancelledBy` columns |
| `b1-error-handling` | 0.1 | 4-arg error handler, request id, supertest app tests |
| `b2-provider-lock` | 0.2 | `withProviderLock`, `createWithin`, `appointments_no_provider_overlap` |
| `b3-appointment-integrity` | 0.3 | transitions, partial-time validation, atomic audits, reactivation checks |
| `b4-patient-integrity` | 0.4 | normalized email, 409 on restore; uniqueness now on the email blind index |
| `c1-auth-separation` | 0.5 | `src/auth/tokens.ts`; forces re-login on deploy |
| `c2-primitives-audit` | 0.7 | OTP/CSRF/safeEqual helpers, `required` audits, portal audit actor |
| `c3-logging-pii` | 0.8 | redaction, request-id mixin, no query strings |
| `c4-abuse-cors` | 0.6 | public/session router classes, CSRF/Origin, coarse in-memory per-IP limiter (the Postgres store was dropped, see 0.6), Cloudflare Turnstile CAPTCHA (fails closed, no bypass) |
| `c5-fail-closed` | 0.9 | unset `NODE_ENV` = production; webhook signature checks always on (no environment bypass) |
| `c6-email-client` | 0.10 | timeout, safe retry, Spanish templates, transactional helper (OTP code kept out of the subject) |
| C6 (#61) | — | provider CSRF: cookie-authenticated provider writes need `X-CSRF-Token` bound to the login `sid` (not in the original plan) |
| `d1-timezone`, `d2-consent-download` | 0.11, 0.19 | luxon DST-correct utils; hardened public download |
| #63, #65 | 0.11 | Spanish user messages; the provider Portal renders every time in `user.timezone`; calendar days stored as UTC midnight (migration `20261018000000_calendar_day_utc_midnight`) |
| `e1`..`e4b`, #64 | 0.14-0.16, 0.18 | provider route group, API clients + Spanish errors (reads and mutations), build fails without `NEXT_PUBLIC_API_URL`, security headers (CSP report-only until `CSP_ENFORCE=true`), self-contained e2e CI, PII-scrubbed Sentry for Server and Portal, `docs/operations.md` |
| `f-legal-compliance` | 0.17, 0.20-0.22 | Colombian privacy policy, `docs/compliance-patient-data.md` |
| #67, #68 | 0.23 | AES-256-GCM encryption of patient PII + keyed blind indexes, 3+ letter prefix name search, backfill on start, email uniqueness on `emailHash`; boot validation of both keys; portal audit actor = HMAC with `BLIND_INDEX_KEY` |

Also landed outside the numbered items: 5000-patient cap per provider, `cancelledBy=PROVIDER` on provider cancels, past-appointment lock narrowed to moves/reactivations/confirms, every `tx` audit made `required`, Renovate + pnpm 12.

Still open before any real-patient pilot: counsel review of the legal text, controller identity/NIT, `BLIND_INDEX_KEY` and `ENCRYPTION_KEY` provisioned and backed up apart from the database (`docs/operations.md`), confirmed backups (`docs/operations.md`), `btree_gist` permission on the production database, CSP enforcement (`CSP_ENFORCE=true`) after a staging soak.

Not a pilot gate but due soon: `ENCRYPTION_KEY` rotation (8.1, not started).

# Patient Portal: architecture proposal

## Context
Patients should be able to self-book with a specific provider. Today `User` is the tenant (every row has `userId`), `Patient` is owned by exactly one provider and has no portal identity or consent record, there is no availability model, and provider-level double-booking is unchecked (`Server/src/appointments/appointment.service.ts:240` `checkConflict` is per-patient and runs outside the transaction).

## Scope decisions (confirmed with user)
- **1-to-1: a patient belongs to one provider.** No cross-provider identity, no `PatientIdentity`/`PatientLink`.
- **Approval**: provider chooses per account between auto-confirm and request-then-approve.
- **Patient auth**: passwordless (email OTP). The session proves control of an email for one provider; it does not carry a `patientId` (see "Session and matching").
- **Provider's own consent form is out of scope** for the portal (provider handles it offline). The portal collects only acceptance of its own privacy/data-processing text.
- **Matching is email only**, no name or phone check.
- No cancellation cutoff. Guardians/dependents out of scope.
- **Compliance (encryption/blind index of patient contact fields):** decided and implemented (0.23). Matching uses the `emailHash` blind index.

## Review round 3 (five smaller findings, all verified against the code and accepted)
1. Range type: columns are `TIMESTAMP(3)`, so the exclusion constraint uses `tsrange(...,'[)')` (0.2).
2. `otp/verify` is exempt from the CSRF header but still requires the exact `Origin` (Public API surface).
3. Consent is one idempotent `ensureCurrentConsent` operation used by `POST /consent`, booking and approval (Session and matching).
4. Virtual booking: 5.4 relaxes the meeting-URL invariant with `meetingStatus=PENDING`, a durable `provision-meet` job and a defined fallback; confirmation waits for `READY` or the fallback (Booking transaction, 4.2, 5.4).
5. Required audits rethrow, and `BOOKING_REQUEST`/`PATIENT_CONSENT` are added to `EntityType` (0.7, Booking transaction).

## Review round 2: findings and where they are addressed
All eight findings were checked against the code and accepted.
| # | Finding | Addressed in |
|---|---|---|
| 1 | No valid Patient state right after OTP (`name`/`lastName` required, consent comes later) | Session and matching; 3.3, 4.1 |
| 2 | "CORS without credentials" contradicts cookie auth | Public API surface; 0.6 |
| 3 | Transaction boundary undefined (`create` opens its own tx) | Booking transaction; 0.2, 4.1 |
| 4 | Slot semantics unspecified | Slot contract; 2.1, 2.2 |
| 5 | Many deleted patients can share an email | Session and matching; 0.4, 6.6 |
| 6 | Slug aliases defeat revocation | Slug and routes (aliases dropped) |
| 7 | `/confirm/[token]` has no lifecycle and would be logged | Removed; 0.8 |
| 8 | Compliance decision deferred past the pilot | 0.23; pilot gate in Phase 4 |

## Slug and routes
- Slug: `User.bookingSlug`, unique, `[a-z0-9-]` 3-40 chars, auto-suggested from `displayName` (suffix on collision), editable in settings. Reserved words blocked (`login`, `api`, `admin`, `book`, `dashboard`, etc.). The slug is for readability and revocability, not secrecy (the cuid is already public via the consent download link, see 0E).
- **No aliases/redirects in the MVP.** Changing the slug immediately revokes the old URL (it behaves like an unknown slug). The settings UI warns that shared links will stop working. Expiring, revocable aliases can be added later if broken links become a real problem. This also avoids needing uniqueness across two tables.
- Portal pages (outside `(protected)`): `/book/[slug]` (browse and book) and `/book/[slug]/appointments` (the patient's appointments and booking result). **No token-bearing URLs anywhere**: no confirmation or manage links. The confirmation email links to `/book/[slug]/appointments`, which requires OTP login.
- Settings page shows a copyable link and QR code.
- Unknown and disabled slugs respond identically.

## Public API surface (two classes of endpoint)
**Anonymous, no cookies** (CORS allow-list of Portal origins, `credentials: false`, client uses `credentials: 'omit'`):
- `GET /v1/public/providers/:slug` (provider card, bookable types/locations)
- `GET /v1/public/providers/:slug/slots?typeId=&from=&to=`
- `POST /v1/public/providers/:slug/otp` (always returns the same 202)

**Credentialed patient session** (`/v1/portal/*`, exact-origin allow-list with `credentials: true`; on every non-GET request the `Origin` header must be present and exactly match, otherwise 403; plus a CSRF header on every non-GET request **except `otp/verify`**, which creates the session and returns its first CSRF token, so it requires the exact `Origin` but no CSRF header (the one-time code plus the Origin check cover login CSRF); logout needs only the exact `Origin` (it must clear the cookie even when the session no longer validates); every other mutation requires the CSRF header):
- `POST /v1/portal/:slug/otp/verify` (sets the session cookie), `GET /v1/portal/session`, `POST /v1/portal/consent`, `POST /v1/portal/bookings`, `GET /v1/portal/appointments`, cancel, reschedule, logout.
- Cookie `portal_session` (name and secret distinct from provider cookies): httpOnly, Secure, path `/v1/portal`. If API and Portal share a registrable domain (the config already has `COOKIE_DOMAIN`), prefer `SameSite=Lax`; otherwise `SameSite=None` with the Origin check and CSRF header mandatory. Confirm the deployed domains in 0.6.
- **CSRF token:** the Portal origin can't read an API-domain cookie, so the token is returned in the `verify`/`session` response body, held in memory, sent as `X-CSRF-Token`, and validated as an HMAC bound to the session id.
- The global credentialed CORS in `app.ts` must be scoped to provider routes only; each public router gets its own CORS config mounted before it.

## Session and matching
**Stage 1: verified-email session (no Patient involved).** `otp` then `otp/verify` issue a short-lived session (about 2 hours) with claims `{typ:'portal', aud:'portal', userId, email}`. Nothing is created or looked up, and responses don't depend on whether a patient exists.

**Stage 2: patient resolved per request** from `(userId, emailHash)` (blind index of the normalized email, 0.23; `email` is ciphertext and can't be queried). Matching lives in one function:
1. Active (non-deleted) `Patient` with that email → that patient. (The partial unique index `patients_userId_emailHash_active_key` guarantees at most one.) If `portalAccessEnabled=false` (provider revoked) or `status` is inactive: treated like "unavailable" and answered with the same generic response; inactive routes to review once 6.6 exists.
2. No patient with that email at all (deleted or not) → none yet; one is created inside the booking transaction.
3. Only soft-deleted patients with that email → **possibly several** (the index excludes deleted rows). No single candidate id is stored. Until 6.6 the booking gets the same generic failure as case 1's unavailable case. From 6.6 the booking becomes a `BookingRequest`, and the inbox lists all deleted patients with that normalized email for the provider to restore one or create a new patient.
- **The portal never updates an existing Patient from typed input.** Typed name/phone apply only when creating a new Patient.
- Required for a new Patient: `name` and `lastName` (schema requires both) collected in the booking form, email from the session, phone optional, `reminderChannel=EMAIL`, `source=PORTAL`.
- **Consent without leaking existence:** `GET /v1/portal/appointments` returns `{appointments: [], consentRequired: true}` both when no patient exists and when the patient hasn't accepted. There is **one idempotent operation, `ensureCurrentConsent(tx, patientId, policyVersion, evidence)`**: it reuses the active (`revokedAt IS NULL`) `PatientConsent` for that patient, kind and policy version, or inserts it (`INSERT ... ON CONFLICT DO NOTHING` against a partial unique index on `(patientId, kind, policyVersion) WHERE revokedAt IS NULL`, then select), so concurrent calls can't create duplicates. `POST /v1/portal/consent` calls it when a patient exists and returns the same 204 whether it did anything or not (no patient yet). Booking always requires `consentAccepted: true` in its body (the UI always shows the checkbox, since the portal can't know who is an existing patient) and calls the same operation inside the booking transaction, so a prior consent is reused and never duplicated. In approval mode it is called on approval with the evidence stored on the `BookingRequest`, preserving the original acceptance time.
- Revocation: `portalAccessEnabled=false` takes effect on the next request (checked per request, no token version needed). If the provider changes a patient's email, the old email's session simply stops resolving to that patient.
- Email only, no name/phone check (user's choice). Risk: a shared or stale email attaches someone to the wrong record. Mitigation: provider can disable portal access per patient, every portal action is audited.
- Known limitation: existing patients without an email can't be matched and would be duplicated; resolve later with a merge action in the inbox.

## Slot contract
`GET /v1/public/providers/:slug/slots?typeId=&from=YYYY-MM-DD&to=YYYY-MM-DD` (dates in the provider's timezone, range at most 31 days).
- **Duration comes from the server**: `AppointmentType.defaultDuration` (and price from the type's `defaultPrice`; location price is never used). The client never sends it. Location doesn't change availability (one calendar per provider) or price; it only matters for whether it is `bookableOnline`.
- **Grid:** candidate start times fall every `slotIntervalMinutes` (provider setting) real minutes from the start of each availability window. This is the grid interval, not the appointment length.
- **Fit:** an appointment `[s, s+duration)` must lie entirely inside a single availability window.
- **Intervals are half-open** `[start, end)`; back-to-back appointments are allowed when the buffer is 0.
- **Buffer:** `bufferMinutes` is dead time between appointments. A candidate conflicts if its `[s, e)` overlaps any busy interval expanded by the buffer on both sides. Busy = SCHEDULED/CONFIRMED appointments and active `BookingRequest` holds (expanded), and `BlockedTime` (not expanded). The buffer is enforced by the portal inside the lock; admin-created appointments ignore it, and the DB exclusion constraint covers only true overlaps.
- **Lead time and horizon:** `s >= now + minLeadMinutes` and `s < startOfLocalDay(now) + maxHorizonDays` (calendar days in the provider zone, so the last bookable day is whole and the horizon does not shift with the time of day or DST).
- **Timezone/DST:** windows are weekday rules in provider-local wall time, converted to UTC per calendar date with a real tz library (0.11), so summer and winter offsets are right. A clock jump inside an open window (DST night, about 02:00) is deliberately not special-cased: the window gets the converted start and end (`localToUtc` conventions) and the real-minute grid, so it is an hour shorter or longer and later starts sit off the wall-clock grid. Accepted: practice hours never span it, and generation and validation still agree.
- **Response:** `{ timezone, slots: [{startUtc, endUtc}] }` only.
- **Booking revalidates** with the same function (`isSlotAvailable`) inside the booking transaction, and the start must be exactly on the grid.

## Booking transaction (auto-confirm)
`appointmentService.create` currently validates and checks conflicts outside its transaction using the global client, then opens its own `$transaction` (`appointment.service.ts:299-395`). It must become transaction-aware:
- Refactor to `createWithin(tx, dto, userId, opts)`; the existing `create` wraps it in its own transaction. All validators and conflict checks take the `tx` client.
- A shared helper `withProviderLock(tx, userId)` runs `pg_advisory_xact_lock` on the provider. It is taken by: admin create/update/reschedule/reactivation, blocked-time create/update, `BookingRequest` hold creation and approval, and the public booking.
- Public booking runs, in **one transaction**: provider lock → validate type/location bookable → `isSlotAvailable` → resolve or create Patient (never modify an existing one) → `ensureCurrentConsent` → `createWithin` → **required** audits (they must rethrow, see below) → enqueue the confirmation via `fromPrisma(tx)`. Anything failing rolls back everything.
- **Required audits must not be swallowed.** `auditLogService.create` currently catches and logs errors (`audit-log.service.ts:17-25`), so passing `tx` isn't enough: a failed audit would be hidden, and in Postgres a failed statement already aborts the transaction, surfacing later as a confusing commit error. Add a `required` mode (`createOrThrow`/`logAudit({required: true})`) that rethrows, and use it for every audit inside portal booking, consent, approval and the atomic fixes in 0.3. Best-effort audits stay for non-transactional legacy paths.
- Approval mode: the same transaction creates a `BookingRequest` plus hold instead, carrying typed details and the consent evidence (policy version, time, IP, user agent). Patient creation and `PatientConsent` are written on approval, copied from the request.
- **No external calls inside the lock or transaction.** Until 5.4, virtual locations are not online-bookable. 5.4 explicitly relaxes the existing invariant: `appointmentMeetingService.resolveMeetingUrl` (`appointment-meeting.service.ts:21,31`) throws `AppointmentMeetingUrlRequiredError` for a virtual location without a URL, so the portal path passes an explicit `meetingStatus: PENDING` option that allows a null `meetingUrl`, and provisioning happens through a durable job (see 5.4).

## Review inbox UX
- One shared **Solicitudes** inbox (`/requests`, Pending / Resolved / Expired) for both review and approval-mode requests, backed by `BookingRequest` (email, typed details, slot, kind, status, `holdExpiresAt`, consent evidence). Candidate patients are computed at view time, never stored as one id; the side-by-side panel renders only when candidates exist.
- Held slot shows on the calendar as a dashed "Pending review" block. Sidebar badge and dashboard card show the open count.
- Detail view: requested data (email marked verified, typed fields unverified) vs candidate(s), differences highlighted, last visit shown, reason flagged. Actions: use/restore the chosen existing patient, create a new patient (provider picks which record keeps the email), or reject (slot released, neutral message). Every action writes an `AuditLog` row.
- Hold expires after about 48h (pg-boss cron), nudge at about 24h. Patient sees a neutral "pending confirmation" state with a cancel button.
- **Notifications:** in-app badge plus an outbound message on the provider's `User.reminderChannel` (`schema.prisma:202`, honoring `reminderActive`) via `dispatchMessage` (`src/scheduler/dispatch.ts`). Generic text with a link, no patient details. WhatsApp needs a new approved Twilio template (new `TWILIO_*_SID` env var; keep `.env.test` and `ci.yml` in sync per AGENTS.md).

## Data model additions (Server/schema.prisma)
- `User`: `bookingSlug`, `bookingEnabled`, `bookingApprovalMode`, `slotIntervalMinutes`, `bufferMinutes`, `minLeadMinutes`, `maxHorizonDays`.
- `AvailabilityRule` (weekday, start/end local time, provider timezone), `PortalOtp`, `BookingRequest`, `PatientConsent` (data-processing only, see 0.20). **No `BookingSlugAlias`.**
- `Patient`: `source`, `portalAccessEnabled` (default true). No token version or verified-at fields (the session carries verification).
- `bookableOnline` on `AppointmentType` and `AppointmentLocation`.
- `Appointment.meetingStatus` (added in 5.4), `PatientConsent` partial unique index `(patientId, kind, policyVersion) WHERE revokedAt IS NULL`.
- `ActionSource.PUBLIC_PORTAL`, `EntityType.BOOKING_REQUEST`, `EntityType.PATIENT_CONSENT`. **No new `AppointmentStatus`**: held slots live only in `BookingRequest`, and the Appointment is created on approval.
- Slots = windows − `BlockedTime` − active appointments − active holds (see the slot contract).

## Server
- New `portal/` module with the two router classes above, mounted outside the provider `authenticate` stack in `app.ts`, each with its own CORS, body limit and rate limits, plus CAPTCHA on OTP request.
- Separate patient JWT (own `aud`, secret and cookie) and middleware, so it cannot pass provider routes (and vice versa). Every portal query is scoped by the session's `userId` and `email`; the client never supplies them.
- Public booking uses a separate minimal DTO: price, `meetingUrl`, `paid` and reminder fields are derived server-side, never client-supplied.
- Reuse Brevo email (`src/brevo/email-client.ts`, `sendTransactionalEmail` in `src/brevo/transactional.ts`, templates in `src/brevo/email-templates.ts`) for OTP and confirmations, and the pg-boss reminder pipeline.
- Allow-list DTOs only; patients see only their own appointments.

## Portal (Next.js)
- `/book/[slug]` route group outside `(protected)`, own layout, Spanish-first, no provider auth probe.

## Hardening
- Overlap checks and lock include active `BookingRequest` holds, not just appointments.
- OTP: per-email and per-provider limits, attempt cap per code, resend cooldown and short expiry, all enforced on the `PortalOtp` record inside the transaction (`src/utils/security/one-time-code.ts`), not by the in-memory per-IP limiter, which is only a coarse throttle. Cron purges expired `PortalOtp` and old `BookingRequest` rows.
- Patient cancel/reschedule has no cutoff, and must call `reminderJobManager.cancel` so no reminder fires for a cancelled appointment.
- Booking flow presents the privacy/data-processing text and records a `PatientConsent` row for the current policy version (0.20 to 0.22).
- **No secrets in URLs** (paths or query strings) anywhere in the portal; add a test that no public route reads tokens from path/query.
- `checkConflict` behavior confirmed by audit (`appointment.service.ts:240-260`, patient-only). Still to verify: what `User.reminderChannel` governs for the provider.

## Phasing
Each step is a separately mergeable PR and leaves `main` working. Everything public-facing sits behind `ENABLE_PORTAL` plus the per-provider `bookingEnabled`. Each step lists its own tests (per `AGENTS.md`).

**Bruno collection rule:** once a step's implementation is complete (routes, DTOs and validation final), the same PR updates `Bruno Collection/`: a request for every new endpoint, edited bodies/params for every changed one, and removed fields or requests for anything dropped. Requests use the environment variables (`dev`/`staging`/`prod`), never real tokens or patient data. A step is not done until its Bruno requests match the code. Phase 1 shipped without them: add a `Booking` folder (`GET/PATCH /v1/booking/settings`, slug suggestion, `GET/PUT /v1/booking/availability`) and `bookableOnline` in the Appointment Types and Locations requests, as a catch-up before Phase 2 merges.

### Phase 0: Foundations (prerequisites found by code audit; no portal feature yet)
Every item is an existing weakness the public portal would amplify. Items are independent PRs unless noted. Paths are under `Server/` unless noted.

**0A. Server: data integrity (blockers)**
- **0.1 Error handling and app-level tests.** `src/app.ts:118` defines a 3-argument handler, which Express never treats as an error handler, so malformed JSON, CORS rejections and oversize bodies hit the default handler (HTML stack traces outside production). Make it 4-argument, return JSON, add a request id, and stop `handleError` returning `String(err)` outside production. Add `supertest` tests for the real app (error handler, CORS, body limits, rate limit), since route tests via `invokeRoute` skip the app layer.
- **0.2 Provider lock and transaction-aware create.** `checkConflict` checks only the patient, runs outside the transaction on the global client, at READ COMMITTED with no lock, and `create` opens a separate `$transaction` at `:317`. (a) Refactor to `createWithin(tx, …)` with all validation and conflict checks on `tx`; (b) add `withProviderLock(tx, userId)` (`pg_advisory_xact_lock`) and take it in admin create/update/reschedule/reactivation and blocked-time mutations; (c) add a provider-level overlap check inside the lock; (d) add a raw migration with `btree_gist` and `EXCLUDE USING gist ("userId" WITH =, tsrange("startAt","endAt",'[)') WITH &&) WHERE (status IN ('SCHEDULED','CONFIRMED') AND NOT "isDeleted")` as a backstop (the columns are `TIMESTAMP(3)`, not `TIMESTAMPTZ`, per `migrations/20260530021411_init_migration/migration.sql:81`, so `tsrange` is the correct type; Prisma stores UTC values, and migrating the columns to `TIMESTAMPTZ` is not needed), mapping SQLSTATE 23P01 to 409, declared outside Prisma's diff. Back-check existing data for overlaps before adding the constraint. Tests: `Promise.all` concurrent creates against real Postgres (feasible with the scheduler off), only one wins; admin create racing blocked-time create; other providers unaffected.
- **0.3 Appointment update integrity.** `update` bypasses `ALLOWED_STATUS_TRANSITIONS` (only `setStatus` enforces it); no conflict re-check when an appointment is reactivated (CANCELLED/COMPLETED to SCHEDULED); a partial `startAt`/`endAt` update can produce `end <= start`; `create` accepts `COMPLETED`/`CANCELLED`; `setStatus`/`markPaid` and their audit rows are not atomic; `appointmentRepository.update` isn't scoped by `userId`. Fix all, with tests (reuse the lock from 0.2).
- **0.4 Patient integrity.** The unique index is on the exact `email` value (`migrations/20260723023603_unique_patient`) and lowercasing happens only in the repository on create/update, so legacy or raw-written rows may differ by case/whitespace. (a) Report case-insensitive duplicates among active patients per provider and resolve them; (b) backfill-normalize (trim + lowercase) and recreate the partial unique index on the normalized expression, in a raw migration; (c) normalize in the zod schema and add `findByEmail` using the same expression; (d) restore collides with the index and surfaces as 500 (return 409); (e) the update catch has a non-null assertion on a possibly-undefined email; (f) `PatientEmailConflictError` echoes the email and reveals existence (public paths use a neutral error); (g) keep the index declared outside Prisma's diff to avoid drift.

**0B. Server: security baseline for public routes**
- **0.5 Auth separation.** Pin JWT `algorithms`, add `aud`/`iss`, make `authenticate` reject refresh and portal token types explicitly, use a separate secret (or at least `aud`) and cookie name for the portal session. Today one `AUTH_SECRET` signs everything and `isAuthPayload` only checks that `id`, `email` and `role` are strings.
- **0.6 Abuse protection and CORS split.** *(Done, with one change: the Postgres limiter store was removed. `createPublicLimiter` is an in-memory per-IP throttle that resets on restart and is per instance; brute-force-sensitive limits live on the domain record instead. CAPTCHA is Cloudflare Turnstile, required in every environment.)* Originally: shared-store rate limiter (Postgres, since in-memory resets per process and per instance) with separate public limits keyed by IP and by email/provider; public routers with a small body limit (about 10kb) mounted before the global 15mb parsers; restructure `app.ts` so the global credentialed CORS applies only to provider routes, with the two public classes configured as in "Public API surface" (anonymous: no credentials; patient session: exact-origin credentialed, mandatory `Origin` check and CSRF header); document `trust proxy: 1` hop assumptions; CAPTCHA integration point. Confirm the deployed Portal and API domains to decide `SameSite=Lax` vs `None`. Tests via `supertest`: cross-origin preflight for each class, missing/mismatched Origin rejected, cookie attributes.
- **0.7 Token and actor primitives.** Generic hashed one-time code helper (template: `GoogleOAuthState` in `src/google/google-connection.repository.ts`), shared `timingSafeEqual`, attempt counters and cooldowns, HMAC CSRF helper. Audit: add `ActionSource.PUBLIC_PORTAL`, and `EntityType.BOOKING_REQUEST` and `EntityType.PATIENT_CONSENT` (the enum at `schema.prisma:535` has neither) in one DB enum migration; support a patient actor via `runInAuditContext`; make patient/appointment audit writes use the same transaction (today `setStatus`, `markPaid`, delete, restore and patient writes audit non-atomically); and add a `required` audit mode that rethrows, because `audit-log.service.ts:17-25` swallows failures (see "Booking transaction").
- **0.8 Logging and PII.** `http-logger.ts` logs `originalUrl` and the full query at info level. Extend the pino `redact` list (email, `to`, name, phone, whatsapp/sms numbers), use `maskEmail` in `patient.repository.ts` and the send clients, stop logging query strings, add request-id child loggers, quiet the unknown-route warning. Enforce "no secrets in URLs" for portal routes with a test.
- **0.9 Fail-closed defaults.** `config.env` defaults to `development`, which makes Brevo/Twilio webhook auth skip verification when `NODE_ENV` is unset; default to production behavior or require it. Audit the already-public `/v1/consent-document` and `/v1/google` routers for exposure.
- **0.10 Email client.** `sendEmail` is generic enough for OTP but has no timeout/`AbortSignal`, no retry, no templates, and surfaces Brevo error text. Add a timeout, a transactional helper with Spanish templates, and never return provider error text to public callers.

**0C. Server: correctness and hygiene**
- **0.11 Timezone correctness.** `localToUtc` (`src/utils/time/time-utils.ts:16`) is single-pass and wrong near DST; latent today because America/Bogota has no DST. Replace with a proper library (luxon or date-fns-tz) and add DST tests (gap and overlap days) before the slot generator (2.1).
- **0.12 Config/CI hygiene.** Fix `.env.example` drift (wrong Twilio meeting-link SID name, unused vars, missing `COOKIE_DOMAIN`), run Server lint in CI, trigger CI on pushes to `staging`, add `ENABLE_PORTAL` plus new vars in all three places (`config.ts`, `.env.test`, `ci.yml`).
- **0.13 Schema prep.** Add `Appointment.source` and `Patient.source` (`PROVIDER`/`PORTAL`), `Appointment.cancelledBy` (provider vs patient), and the composite or partial index for overlap/slot queries.

**0D. Portal and infrastructure**
- **0.14 Split auth providers.** `AuthProvider` wraps every route in `layout.tsx` and calls `/users/me` on mount, so every public visitor triggers a 401 and a refresh attempt. Move it into a provider route group and give public pages a clean layout.
- **0.15 Public API client.** `fetchWithAuth.ts:34` redirects to `/login` on any 401 after a failed refresh, and `/book/*` isn't exempt. Add two clients: anonymous (`credentials: 'omit'`) and portal-session (`credentials: 'include'`, sends the CSRF header), neither with refresh or redirect; plus a Spanish error mapper (server messages are mixed English/Spanish and `useApiMutation` surfaces raw `Server Error: ...`). Fail loudly in production when `NEXT_PUBLIC_API_URL` is unset.
- **0.16 Portal security headers.** `next.config.ts` has none: add CSP, frame-ancestors, `Referrer-Policy`, `Permissions-Policy`. Keep third-party analytics out (the policy promises none). Confirm Vercel deployment protection doesn't block `/book`.
- **0.17 Legal.** The privacy policy and terms explicitly say patients have no account or role; both must be rewritten for patients as data subjects, including Colombian law (Ley 1581 / Habeas Data, SIC), the controller's legal details (still a placeholder), a patient data-rights channel, and a business support address instead of a personal one. This gates any public launch.
- **0.18 Test and deploy infrastructure.** Add a no-auth Playwright project and a mobile project (current config is Chromium only, every test uses an authenticated `storageState`). Run e2e against a self-contained stack in CI (Server, Postgres, Portal, seeded data) instead of staging. Confirm `prisma migrate deploy` runs on release (deploy config isn't in the repo), add error tracking (e.g. Sentry) for Server and Portal, and document Postgres backup and restore (the policy claims backups exist).

**0E. Consent (current state checked directly in code; scope reduced, see decision below)**
What exists today:
- A single provider-level `Document` per user (`schema.prisma:464`, `userId @unique`): the provider uploads a blank consent form. Replace and delete overwrite it; there is no version history, and `Document.checksum` is never populated.
- The consent flow is entirely offline (WhatsApp template `PATIENT_CONSENT_DOCUMENT`, `Server/src/twilio/bulk-template-config.ts:19`, `Portal/src/utils/twilioConfig.ts:75`).
- **Nothing records patient consent**: no fields on `Patient`, no state, no timestamp.
- `GET /v1/consent-document/public/download/:userId.:ext` is already public and unauthenticated, keyed by the provider's cuid, with no per-route rate limit. The cuid is therefore already exposed in links sent to patients.

**Scope decision (user): the provider's own consent form is out of scope for the portal.** The portal does not present it, require it, record it, or gate booking on it, and providers don't need a consent document to enable online booking. The portal collects only acceptance of its own privacy/data-processing text.

Work:
- **0.19 Harden the existing public consent download only.** Add `X-Content-Type-Options: nosniff` and a per-route rate limit; keep existing links working. No versioning or checksum work.
- **0.20 Patient data-processing consent model (design now, build in 3.1).** `PatientConsent(patientId, kind DATA_PROCESSING, policyVersion, acceptedAt, ip, userAgent, revokedAt?)`. Immutable rows; revoke by setting `revokedAt` plus an audit entry. Because a Patient may not exist yet, approval-mode requests carry the consent evidence on `BookingRequest` and it is copied to `PatientConsent` on approval.
- **0.21 Existing patients.** They have no portal consent record, so they are asked to accept the data-processing text at first portal use, before any patient data is shown.
- **0.22 Consent gate (decided):** before a first booking the patient accepts the privacy/data-processing text (one checkbox). Still to confirm with legal: that this satisfies Ley 1581 for this flow.

**0F. Compliance decision gate**
- **0.23 Compliance decision record.** *(Done: decision in `docs/compliance-patient-data.md`; implemented for `Patient.name/lastName/email/whatsappNumber/smsNumber`, `Reminder.to/subject`, `MedicalRecord.name/birthPlace`, with blind indexes per AGENTS.md. The pilot gate is satisfied on the code side; key custody remains in the open list above.)* Decide, in writing, whether `Patient` name, lastName, email, phone fields and `Reminder.to` get encryption plus a blind index (HMAC of the normalized email) before the portal stores patient data. This must come **before** 3.1/3.3 because a blind index changes the unique index (0.4), `findByEmail` and the matching function. Output: a short decision doc, and if "encrypt", the design for the index swap. **Pilot gate:** a pilot with real patient data requires this decision implemented, or an explicit written acceptance by the controller; until then any pilot uses only synthetic or staff data.
- **0.24 Encryption key rotation:** moved to 8.1.

**Phase 0 exit criteria** (all met as of 2026-10-26, pending counsel sign-off on the legal text and consent design): concurrent double-booking impossible (lock plus constraint) and `createWithin` in place; patient and provider tokens mutually rejected; the two CORS classes enforced with Origin and CSRF checks; no PII or secrets in default logs or URLs; normalized-email index in place; unauthenticated Portal pages make no provider API calls; e2e runs against a self-contained stack; legal text updated; consent design agreed with legal (0.20 to 0.22); compliance decision recorded (0.23).

**Suggested order inside Phase 0:** 0.1 → 0.2 → 0.3/0.4 (parallel) → 0.5 → 0.6/0.7/0.8 (parallel) → 0.9–0.13; 0.14–0.16 can run in parallel with all server work; 0.17, 0.18 and 0.23 start immediately because they have lead time.

### Phase 1: Provider setup (provider-only, nothing public) — done (#69, #70)
- **1.1 Schema + migration.** `User` booking settings, `bookableOnline` on type and location, `AvailabilityRule`. Run `prisma generate` (committed client is typechecked).
- **1.2 Availability API + settings UI.** Weekly windows, `slotIntervalMinutes`, `bufferMinutes`, lead time, horizon. Tests: CRUD, validation (windows don't overlap, end after start), tenant scoping.
- **1.3 Online-bookable toggles** on appointment types and locations in the existing screens. Virtual locations can't be marked bookable until 5.4.
- **1.4 Slug management.** Auto-suggest, edit, validation, reserved words, `bookingEnabled` toggle, copyable link and QR; a warning that changing the slug breaks shared links (no aliases).

### Phase 2: Slot engine and read-only public page — done (#72, #73, `05226ec`)
- **2.1 Slot generator.** *(Done, #72: `src/public-booking/slot-engine.ts`.)* Pure function implementing the slot contract (grid, fit, buffer, half-open intervals, lead/horizon, DST). Heavy unit tests: gap and overlap DST days, buffers at window edges, adjacent appointments, blocked time, windows shorter than the duration.
- **2.2 Public read API.** *(Done, #73.)* `GET /v1/public/providers/:slug` and `/slots` per the contract, anonymous CORS class, identical response for unknown and disabled slugs, allow-list DTOs. Tests: cross-tenant isolation, no data leakage, range limit, client-supplied duration ignored.
- **2.3 `/book/[slug]` read-only page.** *(Done, `05226ec`.)* Provider card, type picker, slot calendar, no booking yet. Shippable: patients can browse availability.

#### Phase 2 implementation plan (prepared 2026-10-31)
Starting point (checked in code): `AvailabilityRule` (ISO weekday, `startMinute`/`endMinute` wall-clock minutes in `User.timezone`, 5-minute grid, `endMinute` up to 1440), the `User` booking settings (`slotIntervalMinutes` from `SLOT_INTERVAL_OPTIONS`, `bufferMinutes` 0-240, `minLeadMinutes`, `maxHorizonDays` 1-365), `bookableOnline` on types and locations, and `bookingSettingsService.isBookingLive(userId, tx)` all exist. `resolveLocalTime` (`src/utils/time/time-utils.ts`) already reports DST gaps (`exists: false`) and overlaps (first occurrence). `createPublicApiRouter()` (anonymous CORS, `public-ip` limiter, 10kb parser) has no routes; the Portal has `publicApi` (`credentials: 'omit'`, no refresh/redirect) and `proxy.ts` does not match `/book`. Three PRs, in order; 2.3 can start against a stubbed API once the 2.2 DTOs are merged.

**PR 2.1 — slot engine (pure, no I/O).** `Server/src/public-booking/slot-engine.ts`.
- `generateSlots(input): Slot[]` with `input = { timezone, rules, fromDate, toDate (local YYYY-MM-DD, inclusive), durationMinutes, slotIntervalMinutes, bufferMinutes, minLeadMinutes, maxHorizonDays, now, busy: { appointments: Interval[], blocked: Interval[], holds: Interval[] } }` and `Slot = { startUtc: Date, endUtc: Date }`. `holds` is always empty until 6.1 but is in the signature now so 6.1 changes only the loader.
- Per local date (luxon, iterate calendar days in the provider zone): select rules for that ISO weekday; resolve the window start and end with `localToUtc` (`endMinute = 1440` resolves as 00:00 of the next date). Candidates are `windowStartUtc + k × interval` while `< windowEndUtc`; `endUtc = startUtc + duration`; keep it only if `endUtc <= windowEndUtc` (fit).
- Conflicts: drop a candidate if `[s, e)` overlaps any appointment or hold expanded by `bufferMinutes` on both sides, or any blocked time (not expanded). The buffer applies only against busy intervals, never against window edges. Half-open: touching intervals do not conflict.
- Lead/horizon: keep `s >= now + minLeadMinutes` and `s < startOfLocalDay(now).plus({ days: maxHorizonDays })` (calendar days in the provider zone, so the horizon does not shift with DST or time of day).
- Output sorted by `startUtc`, de-duplicated by instant (rules cannot overlap; deduping makes this safe either way).
- `isSlotAvailable(startUtc, input)`: for the local date containing `startUtc`, checks it lies on a window's grid (`(start - windowStart) % interval = 0`) and passes the same fit/lead/horizon/busy checks, so off-grid starts fail. It is the only validator 4.1 may use.
- Unit tests (`test/unit/public-booking/slot-engine.test.ts`): America/Bogota baseline; America/New_York winter vs summer offset; generation and validation agree on DST nights; interval < duration and interval > duration; window shorter than duration (no slots); `endMinute = 1440`; buffer at window edges (no effect) and around appointments (both sides); back-to-back with buffer 0; blocked time not expanded; holds expanded like appointments; lead time cuts the first slots today; horizon cut on the last day; `isSlotAvailable` accepts generated starts and rejects off-grid, buffered and out-of-window ones.

**PR 2.2 — public read API.** `Server/src/public-booking/{public-booking.routes,service,repository,schemas}.ts`, routes added inside `createPublicApiRouter()` (they inherit anonymous CORS, the `public-ip` limiter and the 10kb parser; no cookies, no CSRF, no CAPTCHA since nothing is written or sent).
- **Provider resolution** (one function, reused by Phase 3/4): normalize the slug with the same rules as `bookingSlugSchema` (trim, lowercase, format); invalid format, unknown slug and `isBookingLive(userId) === false` all return the identical `404 { error: 'Provider not found' }`. The disabled path does a few more queries than the unknown one; accepted, since the slug is not a secret (see "Slug and routes").
- `GET /v1/public/providers/:slug` → `{ displayName, jobTitle, hasAvatar, hasLogo, timezone, lastBookableDate, types: [{ id, name, description, durationMinutes, price }], locations: [{ id, name, address }] }`. `displayName` falls back to first + last name. Types: `bookableOnline`, `isActive`, not deleted; locations: same plus `isVirtual = false` (until 5.4). Never returns `userId` (type and location ids are the only ids exposed), email, phone, settings, `instructions` (shown after booking, Phase 4) or approval mode (Phase 6). `Cache-Control: no-store` for now (settings changes must take effect at once).
- `GET /v1/public/providers/:slug/avatar` and `/logo` → the decoded `avatar`/`logo` data URL as bytes, only for `image/png|jpeg|webp` (anything else or none set: 404), with `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cache-Control: public, max-age=300` and `Cross-Origin-Resource-Policy: cross-origin` (helmet's default `same-origin` would block the Portal's `<img>`). One shared handler for both. Kept out of the JSON because both are base64 strings up to 500KB. Portal CSP `img-src` must add the API origin. (`altLogo` is not exposed.)
- `GET /v1/public/providers/:slug/slots?typeId=&from=&to=` → `{ timezone, slots: [{ startUtc, endUtc }] }` (ISO strings). Query schema: `typeId` uuid, `from`/`to` valid `YYYY-MM-DD`, `from <= to`, at most 31 days inclusive (400 otherwise, Spanish-safe generic message). Unknown query keys (e.g. `duration`) are stripped and ignored. A `typeId` that is not a bookable, active, non-deleted type of this provider → `404 { error: 'Appointment type not found' }` (same for another tenant's type). Duration is always `AppointmentType.defaultDuration`. `Cache-Control: no-store`.
- Loader (`publicBookingRepository.loadBusy(userId, rangeStartUtc, rangeEndUtc, bufferMinutes)`): appointments in `ACTIVE_STATUSES` (move the `appointment.service.ts` constant to a shared module instead of copying it), not deleted, overlapping the range widened by the buffer; non-deleted `BlockedTime` overlapping the range. Range bounds come from the local `from` 00:00 and `to + 1` 00:00 in the provider zone. No lock and no transaction (a read; 4.1 revalidates under the lock).
- **Price (decided 2026-10-31):** the price is `AppointmentType.defaultPrice` only. `AppointmentLocation.defaultPrice` is not used anywhere: not in the public DTOs, not in the slot or booking logic (4.1 derives the appointment price from the type alone). The column and its references were removed in `e2418e8` (migration `20261031000000_drop_location_default_price`).
- Integration tests (`test/integration/public-booking/public-booking.routes.integration.test.ts`, supertest on the real app like `public-api.integration.test.ts`): unknown, invalid, disabled, not-ready (no bookable type), inactive and deleted providers give byte-identical 404s; `ENABLE_PORTAL` off → route absent; the provider DTO has exactly the allow-listed keys (deep key snapshot, no location price); avatar/logo 404 when unset; non-bookable, inactive, deleted and virtual types/locations hidden; another tenant's `typeId` 404; `duration` query ignored; range > 31 days, reversed range and bad dates 400; slots exclude SCHEDULED/CONFIRMED appointments (with buffer) and blocked time but not CANCELLED/deleted appointments; two providers' calendars don't affect each other; responses carry no `Set-Cookie` and `Access-Control-Allow-Credentials` is absent; avatar content-type allow-list + nosniff. Update the AGENTS.md coverage matrix and add a calendar rule: "public availability goes through `generateSlots`/`isSlotAvailable` only".
- Bruno (after the endpoints are final): new `Public Booking` folder with `Get Provider`, `Get Slots` (example `typeId`/`from`/`to`), `Get Avatar` and `Get Logo`, all without auth headers and using a `{{bookingSlug}}` variable in the environments.

**PR 2.3 — `/book/[slug]` read-only page (Portal).**
- Route `src/app/book/[slug]/page.tsx` with its own `layout.tsx` (outside `(provider)`, so no `AuthProvider`, no `/users/me` probe), `metadata.robots = { index: false }`, Spanish only. Data via `publicApi` hooks in `src/api/public-booking/` (`useFetchPublicProvider`, `useFetchPublicSlots`); check that `useApiQuery` can take the anonymous client, otherwise add a thin variant rather than routing through `fetchWithAuth`.
- Layout: provider card that always shows the avatar (from the avatar endpoint; initials when `hasAvatar` is false), name and job title, plus the logo in the page header only when `hasLogo` is true; type picker (name, duration, price in COP); in-person locations listed as information; a slot browser that loads 7 days at a time (one request per week, well under the 31-day cap), days with slots as chips, times grouped by morning/afternoon; "anterior/siguiente semana" bounded by today and the horizon (when a week is empty, say so and offer the next week). A disabled "Reservar" button with "Pronto podrás reservar en línea" is the Phase 4 hook.
- Time display (decided 2026-11-01): patients only ever see times in their own device zone, never the provider's, for every appointment type. Weeks are the patient's calendar days; the slots query stays in provider dates, padded by two days on each side (any two zones are at most 26 h apart) and filtered back to the patient's week; the horizon is converted to the patient's calendar. An "Horas en tu zona horaria: <zona>" label names the zone. Never use `Date` getters.
- States: loading skeletons, the identical "Esta página de reservas no está disponible" for any 404, a generic error with retry for 5xx/429 (mapped by the existing Spanish error mapper).
- CSP: add the API origin to `img-src`. `proxy.ts` stays unchanged (it doesn't match `/book`); add a unit test that pins this.
- Tests: unit tests for the slot grouping by local day/period (Bogota and a DST zone) and week paging bounds; Playwright `public` and `public-mobile` projects with a seeded provider (slug, availability, one bookable type and location) covering card + types + slots render, type switch reloads slots, unknown slug page, and no request to `/v1/users/me` or `/v1/auth/*` (network assertion).
- The settings tab's booking link and QR now open a working page; nothing in the provider UI changes otherwise.

**Phase 2 exit criteria:** a provider with booking live gets a public page that shows only allow-listed data and correct slots (buffer, blocked time, lead/horizon, DST-tested); unknown and disabled providers are indistinguishable in responses; the public endpoints set no cookies and accept no credentials; `isSlotAvailable` is ready for 4.1; the Bruno collection covers every Phase 1 and Phase 2 endpoint. Still gated by `ENABLE_PORTAL` and per-provider `bookingEnabled`; no public launch until 0.17 (counsel review) is closed.

**Decided for Phase 2 (2026-10-31):** price comes from the appointment type only (location price unused); the page always shows the avatar (initials fallback) and shows the logo when one is set. **Open:** whether a "next available date" hint is worth a server endpoint later (not in Phase 2: week paging covers it).

### Phase 3: Patient authentication
Prerequisites: 0.5, 0.6, 0.7, 0.10, 0.20, 0.23.
- **3.1 Schema.** `Patient.portalAccessEnabled`/`source`, `PortalOtp`, `PatientConsent`.
- **3.2 OTP.** `otp` (anonymous class, uniform 202) and `otp/verify` (credentialed class), Brevo email template, per-email and per-provider limits, attempt cap, CAPTCHA, purge cron.
- **3.3 Verified-email session.** Cookie, CSRF token, `GET /v1/portal/session`, the single patient-resolution function (stage 2), consent endpoint with the uniform responses. Tests: portal token rejected on provider routes and vice versa, no existence disclosure in any response or timing-visible field, revoked patient behaves like unavailable, email change stops resolving.
- **3.4 OTP step in the UI.**

#### Phase 3 implementation plan (prepared 2026-11-01)
**Decided (2026-11-01):**
- The portal session is a stateless JWT. Logout clears the cookie; a copied cookie stays valid until it expires (at most 2h). Revocation is the per-request `portalAccessEnabled` check, with no session table.
- Patients reach the OTP login from a "Mis citas" page, `/book/[slug]/appointments`. Phase 4's booking form reuses the same component.
- Three PRs, in order.

**Starting point (checked in code):**
- Already built but not used by any route yet:
  - `signPortalToken`/`verifyPortalToken` (`src/auth/tokens.ts`). Claims are `{userId, email}`; there is no `sid` yet.
  - `portalCookieOptions`, `PORTAL_COOKIE_NAME`, `PORTAL_COOKIE_PATH` (`src/auth/portal-cookie.ts`): httpOnly, Secure, Lax, path `/v1/portal`.
  - `requireCsrf` (`src/middlewares/csrf.ts`) and `createCsrfToken` (`src/utils/security/csrf.ts`).
  - The pure OTP helpers in `src/utils/security/one-time-code.ts`.
  - `requireCaptcha` with `createCaptchaVerifier`.
  - `renderOtpEmail` and `sendTransactionalEmail` (`src/brevo/`). The send never throws, and the subject is fixed, so the code never appears in it.
  - `portalPatientAuditContext`.
  - `emailHash` (`src/utils/encryption/blind-index.ts`).
  - `EntityType.PATIENT_CONSENT` and `ActionSource.PUBLIC_PORTAL`.
- `createPortalSessionRouter()` already applies session CORS, the exact-Origin check, the `portal-ip` limiter, the 10kb parser and `cookieParser`, but has no routes.
- Missing:
  - `PortalOtp`, `PatientConsent` and `Patient.portalAccessEnabled`.
  - A policy version constant. `docs/compliance-patient-data.md` defines `policyVersion` as the policy date, `2026-10-19`.
  - Any portal session middleware.
- `patientRepository.findByEmail` takes no `tx` and ignores status.
- Portal: `publicApi` and `portalApi` exist, and `portalApi` stores any `data.csrfToken` automatically. `TurnstileWidget` exists but nothing renders it yet. There is no public or portal mutation hook and no code input.

**PR 3.1+3.2 — Server: schema, OTP request/verify, purge.** Done (`54a6c2d`…`65677b7`).
- **Schema.** Migration `20261101000000_portal_auth`, created with `--create-only`. Read the SQL and delete any DROP of the raw-only objects, then run `prisma generate`.
  - `Patient.portalAccessEnabled Boolean @default(true)`.
  - `PortalOtp`, one row per provider and email, upserted:
    - Fields: `id`, `userId` (→ User, cascade), `emailHash VarChar(64)`, `codeHash VarChar(64)`, `expiresAt`, `attempts`, `consumedAt?`, `lastSentAt`, `sendWindowStart`, `sendCount`, `createdAt`. *(Added in review: `challengeHash`, `failedCount`, `failedWindowStart`.)*
    - Indexes: `@@unique([userId, emailHash])`, `@@index([userId, lastSentAt])`, `@@index([lastSentAt])`.
    - No plaintext email, only the blind index.
  - `PatientConsent`:
    - Fields: `id`, `patientId` (→ Patient, Restrict, since patients are soft-deleted), `userId`, `kind ConsentKind (DATA_PROCESSING)`, `policyVersion VarChar(20)`, `acceptedAt`, `ipAddress?`, `userAgent? VarChar(512)`, `revokedAt?`, `createdAt`.
    - Raw partial unique index `patient_consents_active_key` on `("patientId", kind, "policyVersion") WHERE "revokedAt" IS NULL`. Add it to the AGENTS.md raw-only list.
    - The repository offers only insert and select. Rows are immutable; revocation comes in 7.2.
  - `PRIVACY_POLICY_VERSION = '2026-10-19'` in `src/portal/privacy-policy.ts`. The server is the only authority; the client never sends a version.
- **`POST /v1/public/providers/:slug/otp`** (anonymous class).
  - Body `{ email, captchaToken }`, strict zod. The email is normalized like the patient schema does.
  - Middleware chain: route limiter `createPublicLimiter({ name: 'otp-request-ip' })` (about 10 per 15 min), then `validateBody`, then `requireCaptcha(createCaptchaVerifier(), 'otp-request')`.
  - `portalOtpService.request` steps:
    1. `publicBookingService.resolveProvider(slug)`. A bad or not-live slug gets the same 404 as the public page.
    2. In one transaction, `createMany({ skipDuplicates: true })` the row, then `SELECT … FOR UPDATE` it. Raw SQL is fine here because these columns are not encrypted.
    3. Check three limits on that record:
       - per-email resend cooldown of 60s (`canResend`);
       - per-email cap of 5 sends per rolling hour (`sendWindowStart`/`sendCount`);
       - per-provider cap `PORTAL_OTP_PROVIDER_HOURLY_CAP` (about 100; count of rows with `lastSentAt` in the last hour).
    4. If allowed: `generateNumericCode()`, store `hashOneTimeCode(code, \`${userId}:${emailHash}\`, PORTAL_AUTH_SECRET)`, reset `attempts` and `consumedAt`, and set `expiresAt` to now + 10 min.
    5. After commit, `sendTransactionalEmail(email, renderOtpEmail(...))`. No external call runs inside the transaction.
  - The response is always a `202 { challenge }` of the same shape: patient or not, throttled or not, sent or failed. The reason is logged with the masked email.
  - *(Added in review, 2026-11-01.)* Each issued code gets a random challenge (24 bytes, base64url; its SHA-256 is stored on the row) that only this response carries. A throttled request returns a random unused one. Without it, anyone who knew a patient's email could send 5 wrong codes to the CAPTCHA-free verify endpoint and lock the code.
  - Resend uses the same endpoint with a fresh CAPTCHA token.
- **`POST /v1/portal/:slug/otp/verify`** (session class).
  - Exact Origin required. No CSRF header and no CAPTCHA. Route limiter `otp-verify-ip` (about 20 per 15 min).
  - Body `{ email, code, challenge }`, where `code` matches `^\d{6}$`. A wrong challenge gets the same 400 and is never counted as an attempt.
  - Steps:
    1. `resolveProvider`.
    2. A transaction holding `FOR UPDATE` on the row.
    3. A missing, consumed, expired or exhausted (`areAttemptsExhausted`) row gets one uniform `400 'Invalid or expired code'`.
    4. A wrong code increments `attempts`; the increment is committed before the same 400 is returned.
    5. The right code sets `consumedAt`, so it is single use.
  - *(Added in review, 2026-11-01.)* Daily failure cap: wrong codes also count in `failedCount` over a fixed 24h window (`failedWindowStart`), which a resend does not reset. At `maxFailuresPerDay` (15, three codes' worth) verify rejects even the right code without counting an attempt, and request answers the usual 202 without sending. A successful login resets it. Without it, re-requesting codes allowed about 25 guesses per email per hour (roughly 20% success over a year).
  - On success:
    - Sign the portal token with a new random `sid` claim (add `sid` to `PortalTokenClaims`).
    - Set the cookie with `portalCookieOptions(2h)`.
    - Respond `{ email, expiresAt, csrfToken: createCsrfToken(sid, PORTAL_AUTH_SECRET) }`.
  - No patient lookup happens. The login is logged, not audited, since nothing changes.
- **Purge.** A daily pg-boss cron `purge-portal-otps` in `src/scheduler/pg-boss.ts`, modelled on `complete-appointments`, deletes rows whose `lastSentAt` is older than 24h. Without `ENABLE_SCHEDULER` rows accumulate, bounded at one per provider and email.
- **Tests.** `test/integration/portal/portal-otp.integration.test.ts` uses supertest on the real app with `ENABLE_PORTAL` pinned, `src/brevo/transactional.js` mocked to capture the code, and CAPTCHA via stubbed `fetch`. Cases:
  - Byte-identical 202s for a new email, an existing patient, a deleted-only patient and a revoked patient.
  - The code is never stored or logged in plain form and never appears in the subject.
  - Cooldown, the hourly cap and the provider cap each answer 202 without sending an email.
  - Unknown slug gives 404. CAPTCHA missing gives 400; a provider outage gives 503.
  - A successful verify sets the cookie attributes, returns `csrfToken`, and the cookie decodes to `{userId, email, sid}`.
  - Five wrong codes lock the code, even against the right one. An expired code and a reused code fail.
  - Provider A's code is rejected on provider B.
  - Email case and whitespace are normalized.
  - Two concurrent right-code verifies produce exactly one session.
  - Missing Origin gives 403; a body over 10kb gives 413.
  - Plus a purge case in `workers.integration.test.ts`.
- **Bruno.** A `Portal Auth` folder with Request OTP and Verify OTP. Verify sends an `Origin` header and uses `{{bookingSlug}}`.
- **AGENTS.md.** Matrix rows, plus the rule that OTP limits live on `PortalOtp` under `FOR UPDATE` and the table stores only `emailHash`.

**PR 3.3 — Server: session, patient resolution, consent.** Done (2026-11-01).
- **`requirePortalSession`** (`src/portal/portal-session.middleware.ts`):
  - Reads `req.cookies.portal_session` and runs `verifyPortalToken`.
  - Type-guards `{typ: 'portal', userId, email, sid}` and sets `req.portal` (Express augmentation).
  - Checks `bookingSettingsService.isBookingLive(userId)` on every request. Phase 5 may relax this so patients can still view appointments.
  - Any failure gives `401 'Invalid session'`.
  - It is followed by `requireCsrf({ sessionIdFrom: (r) => r.portal?.sid, secret: () => config.auth.portalJwtSecret })`.
  - Every query is scoped by `req.portal`; the client never supplies `userId` or email.
- **`resolvePortalPatient(session, tx?)`** (`src/portal/patient-resolution.ts`) is the single stage-2 matching function. It is built on a new `patientRepository.findPortalMatch(userId, emailHash, tx)`, which returns the active patient plus whether deleted ones exist. Outcomes:
  - `patient`: active, `status=ACTIVE` and `portalAccessEnabled`.
  - `unavailable`: revoked or inactive, or deleted-only (until 6.6).
  - `none`.
  - The outcome never reaches a response.
- **`GET /v1/portal/session`** returns `{ email, expiresAt, csrfToken, providerSlug, consentRequired }`.
  - `consentRequired` is false only for a `patient` with an active consent at the current version.
  - The shape and value types are identical for every outcome.
  - `providerSlug` lets the Portal spot a session that belongs to another provider, since one cookie path serves every provider.
  - Query-count timing differences are accepted, as for slugs.
- **`POST /v1/portal/consent`** takes body `{ accepted: true }` (`z.literal(true)`).
  - It runs inside `runInAuditContext(portalPatientAuditContext(...))`, then a transaction, then `resolvePortalPatient(tx)`.
  - Only for a `patient` it calls `ensureCurrentConsent(tx, patientId, PRIVACY_POLICY_VERSION, { ip, userAgent })` (`src/patient-consents/`, reused by 4.1 and 6.3). That function does `createMany({ skipDuplicates: true })` (ON CONFLICT DO NOTHING against the partial index), then a select, and returns `{ consent, created }`.
  - When a row is created, it writes an audit `PATIENT_CONSENT` CREATE with `tx` and `required: true`.
  - The answer is always `204`.
- **`POST /v1/portal/logout`** clears the cookie with the same name, path and domain and answers 204. *(Changed in review, 2026-11-01.)* It has no session guard and no CSRF header, only the router's exact-Origin check: behind the guard, a logout while the provider was briefly not live answered 401 and left the cookie, which came back to life when booking was re-enabled (a shared-device risk).
  - *(Resolved 2026-11-01 by the stateless-JWT decision above.)* Logout only clears the cookie: a copied token stays valid until its 2h expiry, because the `sid` is not stored. Revocation is the per-request `portalAccessEnabled` check (through resolution) and the per-request `isBookingLive` check.
- **Tests.** `test/integration/portal/portal-session.integration.test.ts`:
  - Token rejection, all 401:
    - a portal cookie on provider routes;
    - a provider token (cookie or Bearer) on `/v1/portal/session`;
    - tampered, expired or wrong-audience tokens.
  - Session responses have identical keys and types across `none`, revoked, inactive, deleted-only, and a patient without consent. `consentRequired` is false only with a current consent.
  - Bumping the policy version (`vi.mock` of the constant) makes consent required again.
  - Consent POST:
    - answers 204 in every case;
    - creates one row only for a real patient, and concurrent calls still leave one row;
    - writes an audit row with `PUBLIC_PORTAL` and the hashed actor;
    - writes nothing for revoked or `none`.
  - Missing CSRF gives 403 on consent.
  - Logout clears the cookie (same path), also without a valid session; a foreign Origin gives 403.
  - After the provider changes the patient's email, the session stops resolving: `consentRequired` is true and consent is a no-op.
  - A disabled or deleted provider gives 401.
  - A unit test covers the resolution classification.
- **Bruno.** Get Session, Accept Consent and Logout.
- **AGENTS.md.** Matrix rows, plus these rules:
  - mount session routes behind `requirePortalSession`;
  - resolve patients only with `resolvePortalPatient`;
  - record consent only with `ensureCurrentConsent`;
  - add `patient_consents_active_key` to the raw-only list.

**PR 3.4 — Portal: OTP login on "Mis citas".** Done (2026-11-01).
- **API hooks.**
  - Generic `usePublicMutation`/`usePortalMutation` in `src/api/base/`, copying the `useApiMutation` shape: `{mutate, loading, error}` plus an inflight guard.
  - `src/api/portal/`: `useRequestOtp(slug)`, `useVerifyOtp(slug)`, `usePortalSession()` (a 401 means no session, not an error), `useAcceptConsent()`, `useLogout()`.
  - Types in `src/types/PortalSession.ts`.
  - Spanish patterns in `errorMessages.ts` for an invalid or expired code and for CAPTCHA failure or outage. Verify overrides the 401 wording through `statusMessages`.
- **Page.** `src/app/book/[slug]/appointments/page.tsx`: noindex, same layout. It resolves the provider with `useFetchPublicProvider`; any 404 shows the same "no disponible" page.
- **`PortalLogin`** (`src/components/PublicBooking/`):
  - Email step: `type=email`, `autoComplete=email`, and `<TurnstileWidget action="otp-request">`. Submit stays disabled until there is a token. The copy is neutral: "Si el correo es válido, te enviamos un código".
  - Keep the `challenge` from the latest 202 in memory and send it with the code. A resend replaces it. Two tabs requesting at once leave only the last one working; accepted.
  - Code step: `inputMode=numeric`, `autoComplete=one-time-code`, `maxLength=6`.
  - "Reenviar código" has a 60s countdown and resets the widget. "Cambiar correo" goes back to the email step.
- **After login:**
  - If `providerSlug !== slug`, show the login.
  - If `consentRequired`, show a consent card: a checkbox, a link to `/privacy-policy` in a new tab, then the POST.
    - After the 204, continue on local state rather than refetching. The server keeps answering `consentRequired: true` while no patient exists yet, so a refetch would loop.
  - Otherwise show a placeholder, "Aquí verás tus citas" (filled in by 4.3/5.1), and "Cerrar sesión".
  - `/book/[slug]` gains a "Mis citas" link; the "Pronto podrás reservar aquí" notice stays.
- **Config.** Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to `.env.example`. Set it to Cloudflare's test site key `1x00000000000000000000AA` in the CI Portal build.
- **Tests.**
  - Component tests:
    - the login steps;
    - submit gated on the CAPTCHA token;
    - the resend countdown and the wrong-code message;
    - another provider's session shows the login;
    - the consent loop guard and logout.
  - Hook test: `usePortalSession` returns null on 401.
  - E2E: `e2e/tests/public/portal-login.spec.ts` in `public` and `public-mobile`.
    - The CI e2e job runs a tiny mock Brevo HTTP server (`e2e/support/mock-brevo.mjs`), and the Server's existing `BREVO_API_BASE_URL` points at it.
    - The mock records `/smtp/email` and gives the spec the latest code per address. This is the real Server flow with no product bypass.
    - Flow: request, read the code, verify, consent, placeholder. A reload keeps the session (CSRF comes back from `/session`). Logout returns to the login. A wrong code shows the message.
    - Keep stripping the Vercel bypass headers.
- **Risk check, first step of 3.4.** Call siteverify once with the test secret and a dummy token, and see which `hostname` and `action` it returns.
  - If the hostname is not the Portal host, set `CAPTCHA_EXPECTED_HOSTNAMES` in the e2e job and in the local-dev notes.
  - If the action can never match `otp-request`, stop and decide before writing the e2e spec, since local dev has the same problem.
  - *(Result, 2026-11-01.)* The test secret answers `hostname: "example.com"`, **no `action`**, and `metadata.result_with_testing_key: true`. **Decided:** the verifier skips the hostname and action checks only for responses carrying that flag (the test secret already accepts every token, and a real secret never gets the flag); `challenge_ts` is still checked. The Server logs a warning at startup when `NODE_ENV=production` runs with a Cloudflare test secret. No `CAPTCHA_EXPECTED_HOSTNAMES` change is needed.
- **As built.** `usePublicMutation`/`usePortalMutation` live in `src/api/base/useClientMutation.ts`; the portal hooks are `usePortalSession` and `usePortalAuth` (`useRequestOtp`, `useVerifyOtp`, `useAcceptConsent`, `useLogout`). The page is `PortalAppointmentsPage` (`PortalLogin`, `PortalConsent`); the shared "no disponible" and error states moved to `PublicStates.tsx`. A 401 on consent returns to the login. A CAPTCHA rejection or outage has its own Spanish message, and so does a wrong code. `Portal/.env.example` is new (the README already pointed to it). The e2e uses one login test per project, because `otp-request-ip` allows 10 requests per IP per 15 minutes across both public projects and retries. Locally, run `node Portal/e2e/support/mock-brevo.mjs` and start the API with `ENABLE_PORTAL=true BREVO_API_BASE_URL=http://localhost:4010`.
- *(Review fixes, 2026-11-01.)*
  - The session is matched to the lowercased URL slug, so a mixed-case link no longer loops back to the login.
  - "Cambiar correo" keeps the challenge and the countdown. Returning to the same address goes back to the code step without a request; a re-request inside the cooldown would get a throttled random challenge and break the emailed code.
  - A failed logout keeps the session on screen with an error, instead of a fake logout that a reload undoes.
  - A 401 on consent returns to the login with "Tu sesión expiró".
  - The verifier skips the hostname/action checks only when the configured secret is a Cloudflare test secret **and** the answer carries the test flag.

**Phase 3 exit criteria:**
- A patient can prove control of an email for one provider and get a 2h session: an httpOnly cookie plus an in-memory CSRF token.
- Portal and provider tokens are mutually rejected.
- No response reveals whether a patient exists.
- OTP limits are enforced on the domain record.
- Existing patients' consent is recorded once per policy version.
- The Bruno collection covers every Phase 3 endpoint.
- Everything stays behind `ENABLE_PORTAL` and per-provider booking live.

### Phase 4: Booking, auto-confirm only (MVP)
- **4.1 Booking transaction.** Exactly the single-transaction sequence in "Booking transaction", using `createWithin` and `withProviderLock`. Tests: concurrent bookings of one slot (one wins, the other gets a slot-taken error), buffer respected, off-grid and out-of-window starts rejected, consent required, new patient needs name/lastName, existing patient never modified, failure at any step rolls back patient, consent, appointment and queued email. The booking also sends the patient's device IANA zone; it is validated and stored as a nullable `Appointment.patientTimezone` (set only from the patient's device, unlike the always-default `Appointment.timezone` dropped in #71). Tests: an invalid zone gives 400.
- **4.2 Confirmation and reminders.** Confirmation email through Brevo (link to the appointments page, no token), reminders on the `EMAIL` channel. Queue via `fromPrisma(tx)` inside the transaction. Every time sent to or shown to the patient (confirmation, reminders, the patient's appointments page) uses `Appointment.patientTimezone`, never the provider's zone; the provider's calendar and notices stay in `User.timezone`. Tests: a patient in another zone gets their own times, including a DST change between booking and appointment. (The `whenLocal` parameter comment on `renderBookingConfirmationEmail`, `src/brevo/email-templates.ts`, still says "provider's timezone"; switch it to `patientTimezone`.) (In-person only until 5.4; for virtual appointments the confirmation waits for `meetingStatus` to reach `READY` or the defined fallback.)
- **4.3 Booking form, appointments page, and provider notification** of a new booking (on `reminderChannel`).
- **Pilot gate:** end-to-end self-booking is the milestone; pilot with real patients only after 0.23 is satisfied, otherwise synthetic/staff data only.

### Phase 5: Patient self-service
- **5.1 My appointments.** List endpoint and page, own appointments only.
- **5.2 Cancel.** Calls `reminderJobManager.cancel`, frees the slot, notifies the provider, sets `cancelledBy`.
- **5.3 Reschedule.** Atomic cancel-and-rebook under the same lock.
- **5.4 Virtual locations.** (a) Add `Appointment.meetingStatus` (`NOT_REQUIRED | PENDING | READY | FAILED`) and relax the meeting-URL invariant only for the portal path. (b) The booking transaction creates the appointment with `meetingStatus=PENDING` and enqueues a durable pg-boss `provision-meet` job via `fromPrisma(tx)`, with retries and a dead-letter queue (reuse the existing Google Meet service and its encrypted per-provider token). (c) The job creates the Meet space, sets `meetingUrl`, `meetingStatus=READY`, then triggers the confirmation email and reminders. (d) Fallback: if Google is disconnected or retries are exhausted, set `FAILED`, send the confirmation without a link stating that it will follow, and notify the provider to add the URL manually (which sets `READY`). (e) The patient sees "link pending" until `READY`. (f) Only then allow virtual locations to be marked bookable online (1.3). Requires `ENABLE_SCHEDULER`; reject enabling virtual bookable locations when the scheduler is off. Tests: job retry and idempotency, disconnected Google, provider adds the URL manually, cancel while pending.

### Phase 6: Approval mode and review inbox
- **6.1 `BookingRequest` model + holds.** Slot engine and lock count active holds. Tests: held slot not bookable, hold creation races with appointment creation.
- **6.2 Approval mode in the booking flow.** Provider setting, request creation carrying consent evidence, patient "pending confirmation" state.
- **6.3 Solicitudes inbox.** List and detail API and UI, approve and reject, Patient and `PatientConsent` created on approval, appointment created in the same transaction. Calendar shows dashed pending blocks.
- **6.4 Provider notifications.** Sidebar badge and dashboard card, outbound message on `reminderChannel`, new Twilio template.
- **6.5 Expiry cron.** Release holds after about 48h, 24h nudge, patient expiry email.
- **6.6 Review routing.** Inactive and deleted-only matches become requests; the inbox lists all deleted candidates for that normalized email; actions: restore one, create new, reject.

### Phase 7: Provider controls and hardening
- **7.1 Per-patient portal access toggle** (`portalAccessEnabled`) on the patient screen.
- **7.2 Consent management.** Re-consent prompt when a new privacy policy version is published, consent revocation flow, provider view of each patient's portal consent history.
- **7.3 Audit view** for portal-originated actions.
- **7.4 Quality gates.** Playwright e2e for booking, cancel and review flows in `Portal/e2e`, and abuse and rate-limit tests.

### Phase 8: Operational follow-ups (not portal features; can start any time)
- **8.1 Encryption key rotation (was 0.24; not started).** Today `ENCRYPTION_KEY` cannot be rotated: `decrypt` takes a single key and the `enc:v1:` prefix names the format, not the key, so changing the env var makes every encrypted field unreadable. Build: (1) a keyring (`ENCRYPTION_KEY` + `ENCRYPTION_KEY_PREVIOUS`) and an `enc:v2:<kid>:` format that records the key id, still reading `v1`; new writes always use the current key. (2) A re-encrypt command over every `ENCRYPTED_FIELDS` model (10 models, including the `AuditLog` JSON fields), batched and idempotent like `backfill-pii.ts`. `AuditLog` is immutable through the Prisma guard, so it is rewritten with raw SQL as a documented exception (ciphertext only, never content). (3) A runbook in `docs/operations.md`. `BLIND_INDEX_KEY` can already be rotated: set the new key, bump `PII_VERSION`, deploy, and the backfill on start rehashes every row. Until it finishes, rows not yet rehashed are missed by email/phone/name search, `toHash` reply matching and the email unique index, so rotate at a quiet time. Either key is backed up outside Railway before the deploy. **Timing:** not a pilot gate, but build it before real patient data grows, so a leaked key can be rotated right away. Tests: read `v1` and `v2` under a keyring, re-encrypt is idempotent and keeps `updatedAt`, a value under an unknown `kid` fails loudly.
- **8.2 Google Meet connection UX.** Today the connection expires silently. The refresh token's death (`invalid_grant`, `src/google/google-meet.service.ts:28`) is only discovered when the provider clicks "Generar Google Meet": then the connection is marked disconnected and the modal switches to "Reconectar". Until that moment `GET /v1/google/connection` reports `connected: true` from the stored row, so Settings and the appointment modal show a healthy connection that isn't. Build:
  - (a) **Find the cause first.** If the OAuth consent screen is in "Testing" publishing status, Google expires refresh tokens after 7 days; moving it to "In production" (with verification for the Meet scope if required) fixes the root cause. Also check password changes, the 50-token-per-client limit and user revocation. Record the finding in `docs/operations.md`.
  - (b) **Check validity proactively.** A daily pg-boss job (and an optional `?verify=true` on the status endpoint, rate-limited) refreshes the access token for each active connection. On `invalid_grant` it reuses the existing mark-disconnected + audit path. Requires `ENABLE_SCHEDULER`; without it the status endpoint check is the only signal.
  - (c) **Tell the provider before they need it.** A persistent banner in the provider layout ("Tu conexión con Google expiró. Reconéctala para generar enlaces de Meet.") with a one-click reconnect, an outbound notice on the provider's `reminderChannel` when a connection is lost, and a status in Settings that distinguishes "connected", "expired, reconnect" and "never connected" (with `lastUsedAt`/last checked time).
  - (d) **Flag affected appointments.** Upcoming virtual appointments with no `meetingUrl` (or created while disconnected) are listed in the banner/dashboard so the provider can add links before reminders go out.
  - (e) In the appointment modal, show the expired state up front instead of after a failed click, and keep the manual URL field usable either way.
  - Tests: `invalid_grant` from the check job marks the connection disconnected and audits once; status endpoint returns the expired state; the banner renders from that state; reconnect clears it. Google is mocked at `src/google/google-meet.service.js`; no network calls.
  - **Dependency:** 5.4 (portal virtual bookings) relies on the same signal for its `FAILED` fallback and provider notification, so build 8.2 (b)–(c) before 5.4.
- **8.3 Unsaved-changes handling, app-wide.** Today no provider form shows or guards unsaved edits, so leaving a form loses them silently (e.g. Settings → Reserva en línea has four sections with separate save buttons). Build it once and apply it to every form, not per screen: (a) a shared `useUnsavedChanges(dirty)` hook that registers dirty forms and adds a `beforeunload` warning; (b) a "Cambios sin guardar" marker next to the save button in a shared save-row component; (c) a guard on in-app navigation (settings `TabNav`, sidebar links, drawer/modal close) using an in-app confirm dialog, not `window.confirm`. Tests: dirty form warns on tab switch and close, clean or just-saved form does not, cancel keeps the edits.

### Dependency summary
`0 → 1 → 2 → 3 → 4 → 5`; Phase 6 depends on 4; 7.1 depends on 3; 7.2 depends on 4. Phases 5 and 6 can run in parallel after the MVP. Phase 8 is independent of the portal; 8.2 (b)–(c) should land before 5.4. Within Phase 0: 0.2 gates 4.1; 0.4 and 0.23 gate 3.3 (matching); 0.5/0.6/0.7 gate Phase 3; 0.11 gates 2.1; 0.14/0.15 gate 2.3; 0.17 gates any public launch; 0.20 gates 3.1; 0.22 gates 4.1; 0.23 also gates any pilot with real patients; 0.19 is independent. Phase 1 only needs 0.12 and 0.13, so it can start while the rest of Phase 0 finishes.

## Verification
- Integration tests per `AGENTS.md` (real Postgres, mocked Twilio/Brevo/dispatch), including the concurrent-booking race, admin vs portal vs blocked-time races, cross-tenant slug isolation, portal vs provider token rejection, uniform responses regardless of patient existence, and email-normalization collisions.
- `supertest` app-level tests for CORS classes, Origin/CSRF enforcement, cookie attributes, body limits, and the error handler.
- Slot generator unit tests for DST gap/overlap days and buffer/fit rules.
- Playwright e2e for the booking flow in `Portal/e2e` against a self-contained stack.
