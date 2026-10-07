> **Status:** Phase 0 implemented on `staging`; Phases 1+ not started. **Date:** 2026-10-05

## Phase 0 status (2026-10-06)
Implemented as one commit per branch below, all on `staging`. Server: unit + integration suites green; Portal: 160 tests; Playwright run locally against a throwaway stack (the CI `e2e` job has not run yet).

| Branch | Items | Notes |
|---|---|---|
| `phase0/a1-config-ci`, `a2-schema-prep` | 0.12, 0.13 | `ENABLE_PORTAL`, CI on `staging` + lint, `source`/`cancelledBy` columns |
| `b1-error-handling` | 0.1 | 4-arg error handler, request id, supertest app tests |
| `b2-provider-lock` | 0.2 | `withProviderLock`, `createWithin`, `appointments_no_provider_overlap` |
| `b3-appointment-integrity` | 0.3 | transitions, partial-time validation, atomic audits, reactivation checks |
| `b4-patient-integrity` | 0.4 | normalized email index, 409 on restore; **blind-index swap pending (see compliance doc)** |
| `c1-auth-separation` | 0.5 | `src/auth/tokens.ts`; forces re-login on deploy |
| `c2-primitives-audit` | 0.7 | OTP/CSRF/safeEqual helpers, `required` audits, portal audit actor |
| `c3-logging-pii` | 0.8 | redaction, request-id mixin, no query strings |
| `c4-abuse-cors` | 0.6 | public/session router classes, Postgres rate limiter, CSRF/Origin, CAPTCHA hook |
| `c5-fail-closed` | 0.9 | unset `NODE_ENV` = production |
| `c6-email-client` | 0.10 | timeout, safe retry, Spanish templates, transactional helper |
| `d1-timezone`, `d2-consent-download` | 0.11, 0.19 | luxon DST-correct utils; hardened public download |
| `e1`..`e4b` | 0.14-0.16, 0.18 | provider route group, API clients + Spanish errors, security headers (CSP report-only), self-contained e2e CI, opt-in Sentry, `docs/operations.md` |
| `f-legal-compliance` | 0.17, 0.20-0.23 | Colombian privacy policy, `docs/compliance-patient-data.md` |

Still open before any real-patient pilot: counsel review of the legal text, controller identity/NIT, written acceptance or implementation of the contact-field encryption + blind index (`docs/compliance-patient-data.md` section 3), confirmed backups (`docs/operations.md`), `btree_gist` permission on the production database, CSP enforcement after a staging soak.

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
- **Compliance (encryption/blind index of patient contact fields):** decision record required before building patient matching and before any pilot with real patients (0.23).

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

**Credentialed patient session** (`/v1/portal/*`, exact-origin allow-list with `credentials: true`; on every non-GET request the `Origin` header must be present and exactly match, otherwise 403; plus a CSRF header on every non-GET request **except `otp/verify`**, which creates the session and returns its first CSRF token, so it requires the exact `Origin` but no CSRF header (the one-time code plus the Origin check cover login CSRF); logout and every other mutation require the CSRF header):
- `POST /v1/portal/:slug/otp/verify` (sets the session cookie), `GET /v1/portal/session`, `POST /v1/portal/consent`, `POST /v1/portal/bookings`, `GET /v1/portal/appointments`, cancel, reschedule, logout.
- Cookie `portal_session` (name and secret distinct from provider cookies): httpOnly, Secure, path `/v1/portal`. If API and Portal share a registrable domain (the config already has `COOKIE_DOMAIN`), prefer `SameSite=Lax`; otherwise `SameSite=None` with the Origin check and CSRF header mandatory. Confirm the deployed domains in 0.6.
- **CSRF token:** the Portal origin can't read an API-domain cookie, so the token is returned in the `verify`/`session` response body, held in memory, sent as `X-CSRF-Token`, and validated as an HMAC bound to the session id.
- The global credentialed CORS in `app.ts` must be scoped to provider routes only; each public router gets its own CORS config mounted before it.

## Session and matching
**Stage 1: verified-email session (no Patient involved).** `otp` then `otp/verify` issue a short-lived session (about 2 hours) with claims `{typ:'portal', aud:'portal', userId, email}`. Nothing is created or looked up, and responses don't depend on whether a patient exists.

**Stage 2: patient resolved per request** from `(userId, normalized email)`. Matching lives in one function (so a blind index can be swapped in, 0.23):
1. Active (non-deleted) `Patient` with that email → that patient. (The partial unique index guarantees at most one.) If `portalAccessEnabled=false` (provider revoked) or `status` is inactive: treated like "unavailable" and answered with the same generic response; inactive routes to review once 6.6 exists.
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
- **Duration comes from the server**: `AppointmentType.defaultDuration` (and price from the type/location). The client never sends it. Location doesn't change availability (one calendar per provider); it only affects price and whether the type/location is `bookableOnline`.
- **Grid:** candidate start times fall every `slotIntervalMinutes` (provider setting) from the start of each availability window. This is the grid interval, not the appointment length.
- **Fit:** an appointment `[s, s+duration)` must lie entirely inside a single availability window.
- **Intervals are half-open** `[start, end)`; back-to-back appointments are allowed when the buffer is 0.
- **Buffer:** `bufferMinutes` is dead time between appointments. A candidate conflicts if its `[s, e)` overlaps any busy interval expanded by the buffer on both sides. Busy = SCHEDULED/CONFIRMED appointments and active `BookingRequest` holds (expanded), and `BlockedTime` (not expanded). The buffer is enforced by the portal inside the lock; admin-created appointments ignore it, and the DB exclusion constraint covers only true overlaps.
- **Lead time and horizon:** `s >= now + minLeadMinutes` and `s < now + maxHorizonDays`.
- **Timezone/DST:** windows are weekday rules in provider-local wall time, converted to UTC per calendar date with a real tz library (0.11). Nonexistent local times (spring-forward gap) are skipped; ambiguous local times (fall-back) use the first occurrence; duration is measured in absolute time.
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
- Reuse Brevo email (`src/twilio/email-client.ts`) for OTP and confirmations, and the pg-boss reminder pipeline.
- Allow-list DTOs only; patients see only their own appointments.

## Portal (Next.js)
- `/book/[slug]` route group outside `(protected)`, own layout, Spanish-first, no provider auth probe.

## Hardening
- Overlap checks and lock include active `BookingRequest` holds, not just appointments.
- OTP: per-email and per-provider limits on top of the global 30/min/IP, attempt cap per code, short expiry. Cron purges expired `PortalOtp` and old `BookingRequest` rows.
- Patient cancel/reschedule has no cutoff, and must call `reminderJobManager.cancel` so no reminder fires for a cancelled appointment.
- Booking flow presents the privacy/data-processing text and records a `PatientConsent` row for the current policy version (0.20 to 0.22).
- **No secrets in URLs** (paths or query strings) anywhere in the portal; add a test that no public route reads tokens from path/query.
- `checkConflict` behavior confirmed by audit (`appointment.service.ts:240-260`, patient-only). Still to verify: what `User.reminderChannel` governs for the provider.

## Phasing
Each step is a separately mergeable PR and leaves `main` working. Everything public-facing sits behind `ENABLE_PORTAL` plus the per-provider `bookingEnabled`. Each step lists its own tests (per `AGENTS.md`).

### Phase 0: Foundations (prerequisites found by code audit; no portal feature yet)
Every item is an existing weakness the public portal would amplify. Items are independent PRs unless noted. Paths are under `Server/` unless noted.

**0A. Server: data integrity (blockers)**
- **0.1 Error handling and app-level tests.** `src/app.ts:118` defines a 3-argument handler, which Express never treats as an error handler, so malformed JSON, CORS rejections and oversize bodies hit the default handler (HTML stack traces outside production). Make it 4-argument, return JSON, add a request id, and stop `handleError` returning `String(err)` outside production. Add `supertest` tests for the real app (error handler, CORS, body limits, rate limit), since route tests via `invokeRoute` skip the app layer.
- **0.2 Provider lock and transaction-aware create.** `checkConflict` checks only the patient, runs outside the transaction on the global client, at READ COMMITTED with no lock, and `create` opens a separate `$transaction` at `:317`. (a) Refactor to `createWithin(tx, …)` with all validation and conflict checks on `tx`; (b) add `withProviderLock(tx, userId)` (`pg_advisory_xact_lock`) and take it in admin create/update/reschedule/reactivation and blocked-time mutations; (c) add a provider-level overlap check inside the lock; (d) add a raw migration with `btree_gist` and `EXCLUDE USING gist ("userId" WITH =, tsrange("startAt","endAt",'[)') WITH &&) WHERE (status IN ('SCHEDULED','CONFIRMED') AND NOT "isDeleted")` as a backstop (the columns are `TIMESTAMP(3)`, not `TIMESTAMPTZ`, per `migrations/20260530021411_init_migration/migration.sql:81`, so `tsrange` is the correct type; Prisma stores UTC values, and migrating the columns to `TIMESTAMPTZ` is not needed), mapping SQLSTATE 23P01 to 409, declared outside Prisma's diff. Back-check existing data for overlaps before adding the constraint. Tests: `Promise.all` concurrent creates against real Postgres (feasible with the scheduler off), only one wins; admin create racing blocked-time create; other providers unaffected.
- **0.3 Appointment update integrity.** `update` bypasses `ALLOWED_STATUS_TRANSITIONS` (only `setStatus` enforces it); no conflict re-check when an appointment is reactivated (CANCELLED/COMPLETED to SCHEDULED); a partial `startAt`/`endAt` update can produce `end <= start`; `create` accepts `COMPLETED`/`CANCELLED`; `setStatus`/`markPaid` and their audit rows are not atomic; `appointmentRepository.update` isn't scoped by `userId`. Fix all, with tests (reuse the lock from 0.2).
- **0.4 Patient integrity.** The unique index is on the exact `email` value (`migrations/20260723023603_unique_patient`) and lowercasing happens only in the repository on create/update, so legacy or raw-written rows may differ by case/whitespace. (a) Report case-insensitive duplicates among active patients per provider and resolve them; (b) backfill-normalize (trim + lowercase) and recreate the partial unique index on the normalized expression, in a raw migration; (c) normalize in the zod schema and add `findByEmail` using the same expression; (d) restore collides with the index and surfaces as 500 (return 409); (e) the update catch has a non-null assertion on a possibly-undefined email; (f) `PatientEmailConflictError` echoes the email and reveals existence (public paths use a neutral error); (g) keep the index declared outside Prisma's diff to avoid drift.

**0B. Server: security baseline for public routes**
- **0.5 Auth separation.** Pin JWT `algorithms`, add `aud`/`iss`, make `authenticate` reject refresh and portal token types explicitly, use a separate secret (or at least `aud`) and cookie name for the portal session. Today one `AUTH_SECRET` signs everything and `isAuthPayload` only checks that `id`, `email` and `role` are strings.
- **0.6 Abuse protection and CORS split.** Shared-store rate limiter (Postgres, since in-memory resets per process and per instance) with separate public limits keyed by IP and by email/provider; public routers with a small body limit (about 10kb) mounted before the global 15mb parsers; restructure `app.ts` so the global credentialed CORS applies only to provider routes, with the two public classes configured as in "Public API surface" (anonymous: no credentials; patient session: exact-origin credentialed, mandatory `Origin` check and CSRF header); document `trust proxy: 1` hop assumptions; CAPTCHA integration point. Confirm the deployed Portal and API domains to decide `SameSite=Lax` vs `None`. Tests via `supertest`: cross-origin preflight for each class, missing/mismatched Origin rejected, cookie attributes.
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
- **0.23 Compliance decision record.** Decide, in writing, whether `Patient` name, lastName, email, phone fields and `Reminder.to` get encryption plus a blind index (HMAC of the normalized email) before the portal stores patient data. This must come **before** 3.1/3.3 because a blind index changes the unique index (0.4), `findByEmail` and the matching function. Output: a short decision doc, and if "encrypt", the design for the index swap. **Pilot gate:** a pilot with real patient data requires this decision implemented, or an explicit written acceptance by the controller; until then any pilot uses only synthetic or staff data.

**Phase 0 exit criteria:** concurrent double-booking impossible (lock plus constraint) and `createWithin` in place; patient and provider tokens mutually rejected; the two CORS classes enforced with Origin and CSRF checks; no PII or secrets in default logs or URLs; normalized-email index in place; unauthenticated Portal pages make no provider API calls; e2e runs against a self-contained stack; legal text updated; consent design agreed with legal (0.20 to 0.22); compliance decision recorded (0.23).

**Suggested order inside Phase 0:** 0.1 → 0.2 → 0.3/0.4 (parallel) → 0.5 → 0.6/0.7/0.8 (parallel) → 0.9–0.13; 0.14–0.16 can run in parallel with all server work; 0.17, 0.18 and 0.23 start immediately because they have lead time.

### Phase 1: Provider setup (provider-only, nothing public)
- **1.1 Schema + migration.** `User` booking settings, `bookableOnline` on type and location, `AvailabilityRule`. Run `prisma generate` (committed client is typechecked).
- **1.2 Availability API + settings UI.** Weekly windows, `slotIntervalMinutes`, `bufferMinutes`, lead time, horizon. Tests: CRUD, validation (windows don't overlap, end after start), tenant scoping.
- **1.3 Online-bookable toggles** on appointment types and locations in the existing screens. Virtual locations can't be marked bookable until 5.4.
- **1.4 Slug management.** Auto-suggest, edit, validation, reserved words, `bookingEnabled` toggle, copyable link and QR; a warning that changing the slug breaks shared links (no aliases).

### Phase 2: Slot engine and read-only public page
- **2.1 Slot generator.** Pure function implementing the slot contract (grid, fit, buffer, half-open intervals, lead/horizon, DST). Heavy unit tests: gap and overlap DST days, buffers at window edges, adjacent appointments, blocked time, windows shorter than the duration.
- **2.2 Public read API.** `GET /v1/public/providers/:slug` and `/slots` per the contract, anonymous CORS class, identical response for unknown and disabled slugs, allow-list DTOs. Tests: cross-tenant isolation, no data leakage, range limit, client-supplied duration ignored.
- **2.3 `/book/[slug]` read-only page.** Provider card, type picker, slot calendar, no booking yet. Shippable: patients can browse availability.

### Phase 3: Patient authentication
Prerequisites: 0.5, 0.6, 0.7, 0.10, 0.20, 0.23.
- **3.1 Schema.** `Patient.portalAccessEnabled`/`source`, `PortalOtp`, `PatientConsent`.
- **3.2 OTP.** `otp` (anonymous class, uniform 202) and `otp/verify` (credentialed class), Brevo email template, per-email and per-provider limits, attempt cap, CAPTCHA, purge cron.
- **3.3 Verified-email session.** Cookie, CSRF token, `GET /v1/portal/session`, the single patient-resolution function (stage 2), consent endpoint with the uniform responses. Tests: portal token rejected on provider routes and vice versa, no existence disclosure in any response or timing-visible field, revoked patient behaves like unavailable, email change stops resolving.
- **3.4 OTP step in the UI.**

### Phase 4: Booking, auto-confirm only (MVP)
- **4.1 Booking transaction.** Exactly the single-transaction sequence in "Booking transaction", using `createWithin` and `withProviderLock`. Tests: concurrent bookings of one slot (one wins, the other gets a slot-taken error), buffer respected, off-grid and out-of-window starts rejected, consent required, new patient needs name/lastName, existing patient never modified, failure at any step rolls back patient, consent, appointment and queued email.
- **4.2 Confirmation and reminders.** Confirmation email through Brevo (link to the appointments page, no token), reminders on the `EMAIL` channel. Queue via `fromPrisma(tx)` inside the transaction. (In-person only until 5.4; for virtual appointments the confirmation waits for `meetingStatus` to reach `READY` or the defined fallback.)
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

### Dependency summary
`0 → 1 → 2 → 3 → 4 → 5`; Phase 6 depends on 4; 7.1 depends on 3; 7.2 depends on 4. Phases 5 and 6 can run in parallel after the MVP. Within Phase 0: 0.2 gates 4.1; 0.4 and 0.23 gate 3.3 (matching); 0.5/0.6/0.7 gate Phase 3; 0.11 gates 2.1; 0.14/0.15 gate 2.3; 0.17 gates any public launch; 0.20 gates 3.1; 0.22 gates 4.1; 0.23 also gates any pilot with real patients; 0.19 is independent. Phase 1 only needs 0.12 and 0.13, so it can start while the rest of Phase 0 finishes.

## Verification
- Integration tests per `AGENTS.md` (real Postgres, mocked Twilio/Brevo/dispatch), including the concurrent-booking race, admin vs portal vs blocked-time races, cross-tenant slug isolation, portal vs provider token rejection, uniform responses regardless of patient existence, and email-normalization collisions.
- `supertest` app-level tests for CORS classes, Origin/CSRF enforcement, cookie attributes, body limits, and the error handler.
- Slot generator unit tests for DST gap/overlap days and buffer/fit rules.
- Playwright e2e for the booking flow in `Portal/e2e` against a self-contained stack.
