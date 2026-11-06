> **Status:** Phase 0 complete; key rotation moved to 10.10; Phase 1 complete (#69 server, #70 settings tab); Phase 2 complete (#72 slot engine, #73 public read API, `05226ec` `/book/[slug]` page); Phase 3 complete (3.1+3.2 OTP `54a6c2d`…`65677b7`, 3.3 session `8116ebc`, 3.4 "Mis citas" OTP login); Phase 4 built (4.1 booking transaction #78, 4.2 notifications #79, 4.3 Portal booking form and "Mis citas" list); pilot gate pending. Phase 5 (5.1–5.3) built 2026-11-02 (patient cancel, reschedule, "Mis citas" actions); 8.2 (b)–(c) built 2026-11-02; 5.5-A/B (cancel while booking is off, reschedule policy) and 5.4 (virtual portal bookings, server 5.4-A + Portal 5.4-B) built 2026-11-02; Phase 5 complete, including the manual 8.2 (a) check (see "5.5" and "5.4 + 8.2 (a)–(c) implementation plan"); Phase 6 prepared 2026-11-02 (see "Phase 6 implementation plan"); 6.1–6.2 built (#84); 6.3–6.6 built 2026-11-02 on `phase6/inbox-notifications-expiry` (e2e for approval mode moved to 7.4); Phase 7 prepared and built 2026-11-03 on `phase7/audit-quality-gates` (see "Phase 7 implementation plan"); Phase 9 (all channels for login and patient messages) prepared 2026-11-04, 9.1–9.4 built 2026-11-05 with phone login off (see "Phase 9"; 9.0 checks remain before turning it on); public booking profile (bio, specialty, license, public contact), map links, cancel/reschedule policy line, step progress and `.ics` download built 2026-11-04 (no per-provider accent color); booking portal redesign merged 2026-11-06. The portal is not enabled in production. All remaining work is in Phase 10. **Updated:** 2026-11-06

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

Still open before any real-patient pilot: moved to Phase 10 (10.1 to 10.8).

Not a pilot gate but due soon: `ENCRYPTION_KEY` rotation (10.10, not started).

# Patient Portal: architecture proposal

## Context
Patients should be able to self-book with a specific provider. Today `User` is the tenant (every row has `userId`), `Patient` is owned by exactly one provider and has no portal identity or consent record, there is no availability model, and provider-level double-booking is unchecked (`Server/src/appointments/appointment.service.ts:240` `checkConflict` is per-patient and runs outside the transaction).

## Scope decisions (confirmed with user)
- **1-to-1: a patient belongs to one provider.** No cross-provider identity, no `PatientIdentity`/`PatientLink`.
- **Approval**: provider chooses per account between auto-confirm and request-then-approve.
- **Patient auth**: passwordless (email OTP). The session proves control of an email for one provider; it does not carry a `patientId` (see "Session and matching"). *(Phase 9 adds WhatsApp and SMS codes: the session proves control of an email or a phone.)*
- **Provider's own consent form is out of scope** for the portal (provider handles it offline). The portal collects only acceptance of its own privacy/data-processing text.
- **Matching is email only**, no name or phone check. *(Phase 9 adds phone matching, only for a number proven by OTP and never for a number typed in the booking form.)*
- No cancellation cutoff. Guardians/dependents out of scope.
- **Compliance (encryption/blind index of patient contact fields):** decided and implemented (0.23). Matching uses the `emailHash` blind index.
- **Phone login is always allowed (decided 2026-11-06).** It cannot be turned off per provider, and there is no email-only launch.
- **Providers cannot revoke an individual patient's portal access (decided 2026-11-06).** Nothing in the product sets `portalAccessEnabled` to false. The column and its checks stay.
- **Consent is granted once and has no revocation flow (decided 2026-11-06).** Nothing writes `PatientConsent.revokedAt`. Patients are asked again whenever `PRIVACY_POLICY_VERSION` changes.

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
- The per-request `portalAccessEnabled` check remains in the code, but nothing in the product sets it to false (decided 2026-11-06). If the provider changes a patient's email, the old email's session simply stops resolving to that patient.
- Email only, no name/phone check (user's choice). Risk: a shared or stale email attaches someone to the wrong record. Mitigation: every portal action is audited, and the provider can correct the contact on the record, after which the old contact stops resolving to that patient.
- Known limitation: existing patients without an email can't be matched and would be duplicated; a merge action is listed in 10.16. (Phase 9 phone login addresses this for patients with a phone on record.)

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
*(Done in 0.2: `createWithin(tx, dto, userId, opts)` exists and `create` wraps it; `opts` (`source`, `patientTimezone`) added in 4.1.)* Originally, `appointmentService.create` validated and checked conflicts outside its transaction using the global client, then opened its own `$transaction`. It had to become transaction-aware:
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
- **0.24 Encryption key rotation:** moved to 10.10.

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

**Decided for Phase 2 (2026-10-31):** price comes from the appointment type only (location price unused); the page always shows the avatar (initials fallback) and shows the logo when one is set. The "next available date" hint is listed in 10.16.

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
    - The repository offers only insert and select. Rows are immutable; revocation is not in the plan (7.2 was removed).
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

#### Phase 4 implementation plan (prepared 2026-11-01)
**Decided (2026-11-01):**
- A portal booking is created `CONFIRMED` (with `confirmedAt`): the patient chose the slot.
- One linked EMAIL reminder 24h before the start, skipped when the booking is made less than 24h ahead.
- The provider notice goes on `User.reminderChannel` (honoring `reminderActive`); WhatsApp uses a new **required**
  `TWILIO_WHATSAPP_USER_PORTAL_BOOKING_SID`, so the template must be approved before deploy.
- A patient holds at most 3 upcoming portal-sourced appointments.
- Patient pages show times in the device zone (as `/book` does); `Appointment.patientTimezone` is used for emails and
  reminders only. This replaces the 4.2 wording "the patient's appointments page uses `patientTimezone`".

**Starting point (checked in code):** `createWithin` already takes the lock but had no options (`source` always
`PROVIDER`, no `confirmedAt`) and never enqueues SCHEDULED linked reminders (only the 12h reconcile picks them up);
`loadBusy`/`findBookableType` had no `tx`; `patientService.create` opens its own transaction; `renderBookingConfirmationEmail`
exists but nothing sends it; `bookingApprovalMode` is not editable, so every provider is `AUTO_CONFIRM`; `mock-brevo.mjs`
keeps only the latest email per address; e2e runs with `ENABLE_SCHEDULER=false`.

**PR 4.1 — Server: booking transaction + upcoming list.** Built (2026-11-01).
- Migration `20261102000000_portal_booking`: `Appointment.patientTimezone VARCHAR(50) NULL`.
- `createWithin(tx, dto, userId, { source, patientTimezone })`; the repository sets `confirmedAt` on a CONFIRMED create
  (provider path too). `createPatientWithin(tx, dto, userId, { source })` extracted from `patientService.create`.
  `findBookableType`/`loadBusy` take `tx`; new `findBookableLocation`.
- `POST /v1/portal/bookings` (`portal-booking-ip` limiter, `portalSessionGuard`, strict body
  `{ typeId, locationId, startUtc, patientTimezone, consentAccepted: true, patient: { name, lastName, phone? } }`):
  lock → live + `AUTO_CONFIRM` (else 404) → bookable type/location (404) → `isSlotAvailable` (409
  `Slot no longer available`) → resolve patient (`unavailable` → 409 `Online booking unavailable`; `none` → new patient,
  `source=PORTAL`, `reminderChannel=EMAIL`) → cap (409 `Booking limit reached`) → `ensureCurrentConsent` → `createWithin`
  (type price, `paid=false`, CONFIRMED). Calendar conflicts map to the neutral slot error. 201 `{ appointment }`.
- `GET /v1/portal/appointments` → `{ appointments, consentRequired }`; only a consented patient gets their upcoming active
  appointments (at most 50), every other case `{ appointments: [], consentRequired: true }`.
- Tests: `portal-booking.integration.test.ts` (shared `portal-helpers.ts`), schema unit test. Bruno: `Portal Booking`
  folder; Get Slots stores `slotStartUtc`.

**PR 4.2 — Server: confirmation, reminder, provider notice.** Built (2026-11-01). The confirmation now says "Puedes ver tus citas" (cancel/reschedule wording returns with Phase 5). Also fixed: an appointment update that moves a linked reminder now enqueues a new job, and `send-reminder` skips the stale one.
- `createWithin` (and the update path) enqueue SCHEDULED linked reminders with `{ startAfter, db: fromPrisma(tx) }`; the
  reconcile stays as a safety net. `renderLinkedReminder` uses `patientTimezone ?? User.timezone`.
- `book` adds the 24h EMAIL reminder.
- New queue `portal-booking-notify` (`{ appointmentId, kind: 'patient-confirmation' | 'provider-notice' }`, ids only),
  enqueued with `fromPrisma(tx)`; with the scheduler off the same handler runs after commit, best effort. The handler
  skips deleted/inactive appointments and throws on send failure. Confirmation: `renderBookingConfirmationEmail` in the
  patient's zone with a zone label and the appointments link (no token). Provider notice modelled on
  `sendReminderFailureAlert`, generic text without patient details.
- Tests: jobs enqueued in the transaction and dropped on rollback, scheduler-off path, reminder row, patient zone across a
  DST change, each provider channel, `reminderActive=false`.

**PR 4.3 — Portal: booking form, appointments page, badge, e2e.** Built (2026-11-01). As built: `BookingForm` (step 4, inline `PortalLogin embedded`), `PortalAppointmentCard` shared by the success view and "Mis citas", `usePortalQuery` in `src/api/base/useClientQuery.ts` (renamed from `usePublicQuery.ts`), `usePortalBooking` hooks; the drawer badge reuses `OnlineBadge` with a label. Local e2e run: 30/30 public tests.
- `/book/[slug]`: time buttons, step 4 "Confirma tu cita" (summary, location picker, inline `PortalLogin` without a
  session, then name/lastName/phone + consent, `useCreateBooking`), success card, Spanish errors for the three 409s.
- "Mis citas": `usePortalQuery` + `usePortalAppointments`, device-zone cards, empty state.
- Provider: `source` on the `Appointment` type, "Reservada en línea" badge in the drawer and chip.
- E2E: mock-brevo history + `/__test/messages`, `e2e-publica` on `reminderChannel: EMAIL`, `booking.spec.ts`.

### Phase 5: Patient self-service
- **5.1 My appointments.** List endpoint and page, own appointments only.
- **5.2 Cancel.** Calls `reminderJobManager.cancel`, frees the slot, notifies the provider, sets `cancelledBy`.
- **5.3 Reschedule.** ~~Atomic cancel-and-rebook~~ An atomic move of the same appointment under the same lock (decided 2026-11-01, see below).
- **5.4 Virtual locations.** *(Deferred 2026-11-01: not part of the Phase 5 PRs below; it starts after 8.2 (b)–(c) lands. Superseded 2026-11-02 by "5.4 + 8.2 (a)–(c) implementation plan" below: Meet when Google is connected, otherwise the provider adds any link; `FAILED` became `NEEDS_LINK`; no scheduler gate on the toggle.)* (a) Add `Appointment.meetingStatus` (`NOT_REQUIRED | PENDING | READY | FAILED`) and relax the meeting-URL invariant only for the portal path. (b) The booking transaction creates the appointment with `meetingStatus=PENDING` and enqueues a durable pg-boss `provision-meet` job via `fromPrisma(tx)`, with retries and a dead-letter queue (reuse the existing Google Meet service and its encrypted per-provider token). (c) The job creates the Meet space, sets `meetingUrl`, `meetingStatus=READY`, then triggers the confirmation email and reminders. (d) Fallback: if Google is disconnected or retries are exhausted, set `FAILED`, send the confirmation without a link stating that it will follow, and notify the provider to add the URL manually (which sets `READY`). (e) The patient sees "link pending" until `READY`. (f) Only then allow virtual locations to be marked bookable online (1.3). Requires `ENABLE_SCHEDULER`; reject enabling virtual bookable locations when the scheduler is off. Tests: job retry and idempotency, disconnected Google, provider adds the URL manually, cancel while pending.

#### Phase 5 implementation plan (prepared 2026-11-01)
**Decided (2026-11-01):**
- Phase 5 is 5.1–5.3. 5.4 is planned separately once 8.2 (b)–(c) (Google connection check and provider alert) has landed, since its `FAILED` fallback relies on that signal.
- **Reschedule moves the appointment in place:** same id, new `startAt`/`endAt`, under the provider lock. Notes, payment and the reminder link stay. This replaces "cancel-and-rebook".
- **Eligibility:** a patient can cancel **any** of their upcoming active appointments (the WhatsApp quick reply already allows that). They can reschedule only `source=PORTAL` appointments whose type and location are still bookable online, so a provider's own booking is never moved into a slot the provider did not open.
- No cancellation or reschedule cutoff (as decided at the start): allowed while `startAt > now`. The new slot still obeys lead time and horizon.
- **Provider notices** go on `reminderChannel` (honoring `reminderActive`) with no patient details. WhatsApp uses two new **required** templates, `TWILIO_WHATSAPP_USER_PORTAL_CANCEL_SID` and `TWILIO_WHATSAPP_USER_PORTAL_RESCHEDULE_SID`. Both must be approved before deploy. Add them to `config.ts`, `.env.test`, `ci.yml`, `.env.example` and the local `Server/.env`.
- Reschedule duration = the type's current `defaultDuration`, so it matches the slots the patient was shown. Price, status and `confirmedAt` are unchanged. `patientTimezone` is updated from the request.

**Starting point (checked in code):**
- 5.1 is mostly built by 4.1/4.3. `GET /v1/portal/appointments` returns the consented patient's upcoming active appointments, provider-created ones included. `PortalAppointmentDto` has `type: { name }` (no id) and no action flags.
- **Pre-existing gap (fixed in PR 5.1 below):** cancelling an appointment never touches its linked reminder. `setStatus(CANCELLED)` and the repository's cancel branch leave a PENDING reminder, and `send-reminder` checks only the reminder's own status, never the appointment's. So today a 24h reminder still goes out for an appointment the provider cancelled.
- `reminderJobManager.cancel` calls `getBoss()` outside any transaction. Calling it inside a Prisma `$transaction` risks the pool deadlock described in AGENTS.md.
- `appointmentService.update` opens its own transaction, so it can't be composed with the lock and slot check. `loadBusy` counts the appointment being moved, which would block its own neighbouring slots through the buffer.
- `handleReminderUpdate` updates an existing reminder's `sendAt` even when it is already SENT, and only re-enqueues PENDING ones.
- `deliverBookingNotification` skips any appointment that is not active. That is right for booking notices, but wrong for a cancellation notice.
- The provider Portal doesn't show `cancelledBy`.
- The confirmation email says "Puedes ver tus citas". The cancel/reschedule wording was held back until this phase.
- `requirePortalSession` re-checks `isBookingLive`, so when a provider pauses booking, patients can't log in or cancel online. **Kept in Phase 5** (see Open).

Three PRs, in order (PR numbers are not the item numbers above: PR 5.1 covers item 5.2 plus the 5.1 list changes, PR 5.2 covers item 5.3, PR 5.3 is the Portal for both). PR 5.2 can start as soon as PR 5.1's shared pieces (eligibility, the patient-appointment lookup, the notification kinds) are merged; PR 5.3 can start against the PR 5.1 DTO.

**PR 5.1 — Server: cancel + reminder fix + notifications.** Built (2026-11-02). As built:
- The notifications stay in `portal-booking-notifications.ts` (not renamed). `enqueuePortalNotifications(event, id, tx, previousStartAt?)` and `deliverPortalNotificationsNow` take an event (`booked`/`cancelled`/`rescheduled`) instead of fixed kinds.
- Provider SMS/EMAIL text uses separate lines ("Antes:"/"Ahora:" for a reschedule), because formatted times end in "a. m." and a following full stop doubled it. The booking notice line changed the same way.
- The DTO lives in `portal-appointment.dto.ts`. `book` re-reads the created row with `portalAppointmentSelect`, so the flags come from the same fields as the list.
- The cancel audit has no patient name. A reactivated appointment does not get its cancelled reminder back; the provider adds a new one.
- **Shared reminder fix (applies to every path):**
  - `cancelLinkedReminder(tx, appointment, userId)`: a PENDING linked reminder becomes `CANCELLED` in the same `tx`, with a required audit. It is used by `setStatus(CANCELLED)`, by `update` when the status changes to CANCELLED, by the portal cancel, and by the WhatsApp quick-reply cancel (a no-op there, since that reminder was already sent).
  - `send-reminder` also skips a reminder whose linked appointment is deleted or not in `ACTIVE_STATUSES`. This is defense in depth for jobs already in the queue.
  - After commit, when the scheduler is on, `reminderJobManager.cancel(reminderId)` runs best effort (logged on failure). The worker skips non-PENDING reminders anyway, so this only tidies the queue.
- **Eligibility** in `src/portal/portal-appointment-actions.ts`, pure and used by both the DTO and the services:
  - `canCancel`: active, not deleted, `startAt > now`.
  - `canReschedule`: `canCancel`, plus `source=PORTAL`, plus type and location still bookable (`findBookableType`/`findBookableLocation`; non-virtual until 5.4), plus booking `AUTO_CONFIRM`.
  - `PortalAppointmentDto` gains `type: { id, name }`, `canCancel` and `canReschedule`. The type id is already public through the provider profile. Keep the deep key snapshot test.
- **`POST /v1/portal/appointments/:id/cancel`**: `portal-change-ip` limiter (about 10 per 15 min), `portalSessionGuard`, `validateParams` (uuid), strict empty body. No reason field, so no free text or PII.
  - `portalAppointmentService.cancel`, inside `runInAuditContext(portalPatientAuditContext(...))`, runs one transaction:
    1. `withProviderLock`.
    2. `resolvePortalPatient(tx)`. Only a `patient` with current consent goes on.
    3. Load the appointment by `(id, userId, patientId)`, not deleted. It must pass `canCancel`.
    4. Update `status=CANCELLED`, `cancelledAt`, `cancelledBy=PATIENT`, `paid=false` (same as the quick reply).
    5. `cancelLinkedReminder`.
    6. Required `APPOINTMENT` UPDATE audit.
    7. Enqueue the notifications on `tx`.
  - Every miss (none/unavailable/unconsented session, another patient's or provider's id, unknown id, past, already cancelled, deleted) gives the same `404 'Appointment not found'` (`PortalAppointmentNotFoundError`). Cancelling twice is therefore a 404, not an error leak. Answer 204.
- **Notifications** (`portal-booking-notifications.ts` becomes `portal-notifications.ts`; the queue name `portal-booking-notify` is kept so jobs already queued still run):
  - Job payload `{ appointmentId, kind, previousStartAt? }`, ids and timestamps only.
  - New kinds:
    - `patient-cancellation` and `provider-cancel-notice`: require `CANCELLED`.
    - `patient-reschedule` and `provider-reschedule-notice`: require active, and carry `previousStartAt`.
  - Each kind declares the status it requires. The handler re-reads the appointment, skips it when the status doesn't match, and throws on a failed send. Scheduler off: sent after commit, best effort (same as 4.2).
  - Patient emails (`renderPortalCancellationEmail`, `renderPortalRescheduleEmail` in `src/brevo/email-templates.ts`) use `patientTimezone ?? User.timezone` with a zone label and the appointments link (no token). Provider text uses `User.timezone`, has no patient details, and links to `/calendar`.
  - WhatsApp variables: cancel `{1: name, 2: date, 3: time}`; reschedule `{1: name, 2: previous date and time, 3: new date, 4: new time}`.
  - Confirmation copy goes back to "Puedes ver, cancelar o reprogramar tus citas".
- **Tests:**
  - `test/integration/portal/portal-appointment-cancel.integration.test.ts`, supertest on an app wired like `app.ts`:
    - 204 and the row is `CANCELLED`/`PATIENT`/`cancelledAt`, with one `PUBLIC_PORTAL` audit.
    - The slot is free again in `/slots`.
    - The linked reminder becomes CANCELLED.
    - A provider-created appointment can be cancelled.
    - Identical 404s for: another patient's id, another provider's id, unknown, past, cancelled, deleted, a `none`/unavailable/unconsented session.
    - Concurrent double cancel: one 204, one 404, one audit.
    - CSRF, Origin and strict body.
    - A failure after the update rolls back status, reminder, audit and jobs.
  - Reminder fix:
    - provider `POST /:id/cancel` and an `update` to CANCELLED cancel the PENDING reminder;
    - `send-reminder` skips a PENDING reminder whose appointment is cancelled or deleted (`workers`/`scheduler` tests).
  - Notifications (extend `portal-booking-notify.integration.test.ts`): each new kind on each provider channel, `reminderActive` off, the patient zone, a status mismatch skipped, enqueued on `tx` and dropped on rollback, the scheduler-off path.
  - Unit tests: eligibility and the DTO key snapshot.
- **Bruno:** `Portal Booking/Cancel Appointment`.
- **AGENTS.md:** matrix rows. New rules:
  - patient actions go through `portalAppointmentService` (lock, resolve, then own-appointment lookup) with one 404 for every miss;
  - cancelling an appointment by any path cancels its PENDING linked reminder on `tx`;
  - `send-reminder` skips reminders of inactive appointments.

**PR 5.2 — Server: reschedule.** Built (2026-11-02). As built:
- `updateWithin(tx, id, dto, userId, { patientTimezone, replaceSettledReminder })`. The "unlink a settled reminder and link a new one" rule applies only with `replaceSettledReminder` (the portal reschedule). A provider edit still updates the linked reminder in place, so a provider form that resends an unchanged reminder never creates a duplicate.
- The portal service builds the reminder patch: the full EMAIL reminder at `start − 24h`, `null` to cancel a PENDING one under 24h, nothing when a settled reminder is not replaced.
- The 400 message is "New time must differ from the current one".
- **Extract `updateWithin(tx, id, dto, userId)`** from `appointmentService.update`, the same way `createWithin` was extracted. `update` wraps it. The lock stays first (`withProviderLock` is idempotent within a transaction).
- `loadBusy(userId, from, to, buffer, tx, { excludeAppointmentId })`, so the moved appointment doesn't block itself.
- **`POST /v1/portal/appointments/:id/reschedule`**: same limiter and guard. Strict body `{ startUtc, patientTimezone }` (the schemas are shared with booking).
  - `portalAppointmentService.reschedule`, one transaction:
    1. `withProviderLock`.
    2. `isBookingLive(userId, tx)` and `AUTO_CONFIRM`, else the unknown-provider 404.
    3. Resolve the patient and check consent.
    4. Look up the own appointment and check `canCancel`; a miss gives the same 404 as cancel.
    5. `source=PORTAL`, type and location still bookable, else `409 'Reschedule unavailable'` (`PortalRescheduleUnavailableError`). This is not a 404, because the patient can see the appointment.
    6. The new start must differ from the current one (400).
    7. `isSlotAvailable` with the type's current duration on `loadBusy(..., { excludeAppointmentId })`, else `SlotUnavailableError`.
    8. `updateWithin(tx, id, { startAt, endAt }, userId)`. That call re-runs `checkConflict` (excluding itself), blocked time and the past-appointment lock. A conflict maps through `toPortalError` to the neutral slot 409.
    9. Set `patientTimezone`.
    10. Required audit.
    11. Enqueue the reschedule notices with `previousStartAt`.
  - The per-patient cap is not re-checked: the count of upcoming appointments doesn't change.
- **Reminder on reschedule.** The new `sendAt` is `start − 24h`. Make these outcomes explicit in `updateWithin`:
  - PENDING reminder and new `sendAt > now`: update `sendAt` (re-enqueued; the stale job skips).
  - PENDING reminder and new `sendAt <= now`: cancel it.
  - No reminder, or a non-PENDING one (e.g. already SENT because the old time was under 24h away), and new `sendAt > now`: unlink the old reminder (its history is kept) and create a new linked EMAIL reminder.
  - Never rewrite a SENT reminder's `sendAt`.
- Returns 200 `{ appointment }` (`PortalAppointmentDto`).
- **Tests** (`portal-appointment-reschedule.integration.test.ts`):
  - Happy path: same id, new times, type duration, price and status unchanged, `patientTimezone` updated, one audit, both notices.
  - The old slot is free and the new one taken.
  - Moving into a slot that touches its own buffer works (self excluded).
  - Concurrent reschedule vs a booking of the same slot: one winner, the loser fully rolled back.
  - Off-grid, lead, horizon, blocked and taken slots each give the one 409, without the other appointment's times.
  - Same start gives 400.
  - Provider-created appointment, type or location no longer bookable, approval mode: 409 or 404 as specified.
  - All the cancel 404 cases.
  - All three reminder outcomes, including SENT left untouched.
  - CSRF, Origin and strict body (no client `endUtc`/`typeId`/`price`).
  - Rollback on a later failure.
  - Plus a regression run of `appointment.integrity`/`reminder-scheduling` on the extracted `updateWithin`.
- **Bruno:** `Portal Booking/Reschedule Appointment` (uses `slotStartUtc`).
- **AGENTS.md:** matrix row. Calendar rule: patient reschedules go through `updateWithin` after `isSlotAvailable` with the appointment excluded from busy time. Also list the two new env vars.

**PR 5.3 — Portal: actions on "Mis citas", provider badge, e2e.** Built (2026-11-02). As built:
- `useSlotPicker` + `SlotSteps` (`SlotPicker.tsx`) replace the inline picker in `PublicBookingPage`; its existing tests pass unchanged.
- `RescheduleFlow` shows the current appointment, then the picker (steps 1–2), then "Confirma el cambio" with "Antes"/"Ahora".
- The cancel dialog reuses the provider `ConfirmDialog` inside its own `FocusTrapProvider`. Without it, the dialog threw on the public page, where no provider layout mounts one.
- The provider drawer shows "Cancelada por el paciente" next to the status, and the calendar chip adds it to its title. No drawer test exists yet.
- The e2e reschedule and cancel steps extend `booking.spec.ts` on the same session, so no extra OTP request is spent.
- Hooks in `src/api/portal/usePortalBooking.ts`: `useCancelAppointment`, `useRescheduleAppointment`. Types are updated (`type.id`, `canCancel`, `canReschedule`). Spanish messages for the 404 ("Esta cita ya no se puede modificar") and for `Reschedule unavailable`.
- `PortalAppointmentCard` gets "Cancelar cita" and "Reprogramar", shown only from the server flags; the client never re-derives eligibility.
  - Cancel opens an in-app confirm dialog (never `window.confirm`). On a 204 or 404 it refetches the list and shows a status message.
- Reschedule reuses the slot browser:
  - Extract the week/day/time picker from `PublicBookingPage` (335 lines) into a `SlotPicker` that takes `typeId`. `/book/[slug]` and the reschedule view then share it, along with the patient-device-zone rules (`browserTimezone()`, `slotQueryRange`, `lastBookableDateIn`).
  - The appointment being moved is chosen through local state, never the URL.
  - The view shows "Cita actual" plus the new choice and a confirm step.
  - On a taken slot, clear the choice and reload the slots, like the booking form.
  - On success, show the updated card.
- A 401 from either mutation returns to the login ("Tu sesión expiró").
- Provider Portal: add `cancelledBy` to the `Appointment` type. The drawer and chip show "Cancelada por el paciente" for `PATIENT` (this covers the WhatsApp quick reply too). The "Reservada en línea" badge stays.
- **Tests:**
  - Component tests: buttons follow the flags, the confirm dialog (cancel keeps the appointment), the error mapping, a reschedule taken-slot reload, the `SlotPicker` extraction (existing `PublicBookingPage` tests pass unchanged).
  - E2E: extend `booking.spec.ts` (or a new `self-service.spec.ts`) in `public`/`public-mobile`. Book, reschedule to the next free slot, check the reschedule email in mock Brevo (`/__test/messages`), cancel, check the list is empty and the cancellation email arrived.
  - Reuse the booking spec's session so no extra OTP request is spent (`otp-request-ip` allows 10 per 15 min).
  - The run frees its slot by cancelling, which also keeps the shared seeded calendar from filling up across runs.

**Phase 5 exit criteria:**
- A logged-in, consented patient can cancel any upcoming appointment, and reschedule their own online bookings, with no cutoff.
- Both run under the provider lock.
- Both answer neutrally: one 404 for anything not theirs, and one slot 409 that never shows other appointments.
- Both are audited as `PUBLIC_PORTAL`.
- Both notify patient and provider (the provider without patient details).
- No reminder fires for a cancelled appointment, on any cancel path.
- The Bruno collection covers both endpoints.

**Open:**
- ~~Whether patients should keep view and cancel access while the provider has paused booking.~~ Decided 2026-11-02:
  yes, see PR 5.5-A below.
- ~~Whether to cap reschedules per appointment.~~ Decided 2026-11-02: a provider setting, see PR 5.5-A below.
- A "past appointments" history on "Mis citas": moved to 10.11.

#### 5.5: cancel while booking is off + reschedule policy (decided 2026-11-02)
**Decided:**
- Booking off is not portal off. While the provider has paused booking or setup is incomplete, patients can still
  log in, see "Mis citas" and cancel; they cannot book or reschedule. Portal flag off, provider inactive/deleted, or
  no slug stays fully unavailable (the identical 404/401).
- Provider reschedule policy: `maxPatientReschedules` per appointment (0–10, default 2, 0 = none) and
  `minRescheduleNoticeHours` before the current start (0–168, default 0). Cancelling keeps no cutoff.
- `/book/[slug]` while paused shows "Las reservas en línea están en pausa" with a link to "Mis citas".

**PR 5.5-A — Server.** Built (2026-11-02). As built:
- `bookingSettingsService.isPortalReachable` (portal on, provider active and not deleted, has a slug);
  `isBookingLive` builds on it. `resolveProvider(slug, 'reachable' | 'live')`: `reachable` for the profile, images and
  OTP request/verify, `live` for slots. `requirePortalSession` uses `isPortalReachable`. Booking, reschedule and
  reschedule slots keep `requireSelfBooking` (unknown-provider 404 while paused); cancel never checked liveness.
- The profile adds `bookingOpen`; while false, `types` and `locations` are empty. `GET /portal/session` adds
  `bookingOpen`.
- `User.maxPatientReschedules`, `User.minRescheduleNoticeHours`, `Appointment.patientRescheduleCount`
  (`20261104000000_portal_reschedule_policy`). Only the portal reschedule increments the counter, on `tx`.
- `portalActionContext(settings, bookingLive, now)` builds every flag context; `canReschedule` adds the limit and
  the notice (measured from the current start). A failing rule is the existing 409 `Reschedule unavailable`.

**PR 5.5-B — Portal.** Built (2026-11-02). Paused page on `/book/[slug]`; "Mis citas" hides "Reservar una cita" when `!bookingOpen`;
"Reprogramación por pacientes" fields in "Reglas de reserva"; status hint that patients can still cancel while paused.

#### 5.4 + 8.2 (a)–(c) implementation plan (prepared 2026-11-02)
These are the last Phase 5 tasks. They cover the Google work only; the "Open" items above stay open.

**Decided (2026-11-02):**
- **Provider alerts are in-app only.** No WhatsApp, SMS or email for "Google expired" or "a booking needs a link".
  This drops 8.2 (c)'s outbound notice and needs no new Twilio template or env var.
- **A virtual location can be bookable online without Google**, because the provider chooses their own virtual space.
  - If Google is connected, a durable `provision-meet` job creates a Meet link.
  - Otherwise the booking waits for the provider to add a link of their choice, and the patient sees "link pending".
  - The `bookableOnline` toggle has no Google or scheduler gate. This replaces 5.4 (f)'s "reject when the scheduler is
    off".
- `MeetingStatus` is `NOT_REQUIRED | PENDING | NEEDS_LINK | READY`. It replaces 5.4's `FAILED`, since adding a link by
  hand is now a normal path.
  - `PENDING`: the Meet job is in flight.
  - `NEEDS_LINK`: the provider must add a link (Google not connected, scheduler off, or provisioning failed).

**Manual step first (8.2 a, owner: provider account admin).** Check the Google Cloud OAuth consent screen's publishing
status.
- If it is "Testing", refresh tokens die after 7 days; move it to "In production".
- Also rule out password resets and the 50-tokens-per-client limit.
- Record the finding in `docs/operations.md`.

**PR 8.2-A — Server: proactive connection check.** Built (2026-11-02). As built:
- `getConnectionStatus` returns `connectedAt`/`lastUsedAt` for an expired row too (it used to null them).
- **Pre-existing bug fixed:** `rotateRefreshToken` matched the encrypted `refreshToken` column against the plaintext
  token, so a refresh token rotated by Google was never saved. It now compares the decrypted value and guards the
  write with `updatedAt`.
- The new test file is `test/integration/google/google-connection-check.integration.test.ts` (service + worker).
  Google's token refresh is stubbed with `OAuth2Client.prototype.refreshTokenNoCache`.

As planned:
- **Schema:** `GoogleConnection.lastCheckedAt DateTime?`.
- **New `src/google/google-connection.service.ts`:**
  - `isAuthorizationFailure`: moved from `google-meet.service.ts` and exported.
  - `markConnectionExpired(userId, description)`:
    - Replaces the inline catch block in `createMeetingSpace` and the private `markConnectionDisconnected` in
      `google-oauth.service.ts`.
    - Audits only when `markDisconnected` changed a row.
    - Has no hard-coded `ActionSource.API`: the source comes from the audit context, so job runs audit as JOB.
  - `buildOAuthClient(connection)`: extracted with its refresh-token rotation listener.
  - `verifyConnection(userId)`:
    - Calls `getAccessToken()` to force a refresh.
    - Success sets `lastCheckedAt`.
    - An authorization failure calls `markConnectionExpired`.
    - Any other error is logged and leaves the connection unchanged.
- **Daily job `check-google-connections`:**
  - Cron `0 11 * * *` UTC (06:00 Bogotá), next to `purge-portal-otps`.
  - Goes over every active connection, with a try/catch per connection, inside `runInAuditContext(JOB_CTX)`.
  - Runs only with `ENABLE_SCHEDULER`.
- **`GET /v1/google/connection`** returns
  `{ status: 'connected' | 'expired' | 'not_connected', connected, connectedAt, lastUsedAt, lastCheckedAt, disconnectedAt }`.
  - `connected` is kept for compatibility.
  - `expired` means a row that is disconnected or missing the scope. `not_connected` means no row (a manual disconnect
    deletes the row).
  - `POST /google/connection/verify` runs `verifyConnection` and returns the status, rate-limited per user (5/min). (First built as `GET ?verify=true`; moved to a POST because a check calls Google and may write.)
- **Tests:**
  - The three statuses.
  - `verify` sets `lastCheckedAt`, and `invalid_grant` returns `expired`.
  - The rate limit.
  - The worker: `invalid_grant` disconnects and audits once as JOB; a second run is a no-op; a transient error is
    ignored; other providers are untouched.
  - Google is mocked by patching `OAuth2Client.prototype`, as the existing Google tests do.
- **Bruno:** `Google/Get Connection`.

**PR 8.2-B — Portal: expired state.** Built (2026-11-02). As built:
- "Verificar ahora" uses `useVerifyGoogleConnection` (`useApiMutation` now accepts `GET`), then refetches the status.
- The banner renders inside `<main>`, so it gets the page padding.
- An expired connection shows "Reconectar cuenta" (with consent) and no "Verificar ahora".
- The appointment modal puts "Reconectar y generar" ahead of "Regenerar", and adds a hint that a manual link still
  works.

As planned:
- **Types and hook:** `GoogleConnectionStatus` gains `status`, `lastCheckedAt` and `disconnectedAt`.
  `useFetchGoogleConnection` takes `verify`.
- **New `ProviderAlerts` component** in `PageLayout`, between the header and `<main>`:
  - Admins only; a VIEWER gets 403 on the endpoint, so it is never fetched for them.
  - When `status === 'expired'` it shows "Tu conexión con Google expiró. Reconéctala para generar enlaces de Meet."
  - Its "Reconectar" button runs `useGoogleOAuthPopup` + `startOAuth('/settings', true)`.
  - Styled with a new `.warning-banner` class.
- **Settings** shows three states, "Última verificación", and a "Verificar ahora" button (`POST /google/connection/verify`).
- **Appointment modal (8.2 e):** shows the reconnect label up front when the connection has expired.
- **Tests:** `GoogleIntegrationTab`, `LocationAndTimeStep`, and the new `ProviderAlerts`.

**PR 5.4-A — Server: virtual portal bookings.** Built (2026-11-02). As built:
- `resolveMeeting` keeps a `PENDING`/`NEEDS_LINK` status when other fields change or the URL is cleared; clearing a
  `READY` link is still 422, and a provider switching an in-person appointment to virtual still needs a URL.
- Events: `booked-link-pending` (provider notice only), `meeting-ready` (the held confirmation, with the link or
  "Te enviaremos el enlace…"), `meeting-link` (`patient-meeting-link`). `updateWithin` takes an `afterCommit` list so
  `appointmentService.update` sends them after commit without the scheduler.
- The job logic lives in `src/portal/portal-meeting.service.ts` (`meetingPendingMode`, `enqueueProvisionMeet`,
  `provisionMeet`, `markNeedsLink`, `sweepPendingMeetings`, `findNeedsMeetingLink`); the workers are thin.
  `PROVISION_MEET_RETRY_LIMIT = 5`.
- The public profile and `PortalAppointmentDto` never show an address for a virtual location.
- Tests: `portal-virtual-booking.integration.test.ts`, `scheduler/provision-meet.integration.test.ts`, and the
  `needs-meeting-link` route case in `appointment.routes.integration.test.ts`.

As planned:
- **Schema:** `enum MeetingStatus` and `Appointment.meetingStatus @default(NOT_REQUIRED)`. The migration backfills
  `READY` where `meetingUrl` is set.
- **`resolveMeetingUrl` becomes `resolveMeeting(...) → { meetingUrl, meetingStatus }`:**
  - In-person → `NOT_REQUIRED`.
  - Virtual with a URL → `READY`.
  - Virtual without a URL is allowed only in two cases:
    - on create, with the portal-only `createWithin` option `meetingPending: 'auto' | 'manual'` (→ `PENDING` /
      `NEEDS_LINK`);
    - on update, when the stored status is already `PENDING`/`NEEDS_LINK`.
  - Otherwise it is still `AppointmentMeetingUrlRequiredError`, so the provider path is unchanged.
- **Booking (`book`):**
  - A virtual location is `auto` when the scheduler is on and the provider has an active Google connection with the
    scope (read on `tx`). Otherwise it is `manual`.
  - `auto` enqueues `provision-meet { appointmentId }` on `tx` (`fromPrisma(tx)`, `singletonKey`).
  - No external call happens inside the lock.
- **Notifications:**
  - `booked` always sends the provider notice. It holds back the patient confirmation while the appointment is
    `PENDING`.
  - New kind `patient-meeting-link` (active, future, `source=PORTAL`).
  - The confirmation and reschedule emails print the link for a virtual location, or "Te enviaremos el enlace de la
    videollamada en un correo aparte." when it is pending. They print no address for a virtual location.
  - `onMeetingLinkSet(tx, id, previous)` runs from `updateWithin` when the URL of a portal appointment changes:
    - from `PENDING`, it sends the held confirmation;
    - from `NEEDS_LINK` or `READY`, it sends `patient-meeting-link`.
- **Job `provision-meet`** (retry 5 with backoff):
  - It skips unless the appointment is `PENDING`, active and not deleted, so it is idempotent.
  - It calls `createMeetingSpace` outside any transaction.
  - It then opens a short transaction:
    1. `withProviderLock`.
    2. Re-check `PENDING`.
    3. Set the URL + `READY`.
    4. Re-render the linked reminder.
    5. A required JOB audit.
    6. Enqueue the confirmation.
  - Failures:
    - Connection missing, scope missing, token revoked or config missing → `NEEDS_LINK` + the confirmation ("link will
      follow").
    - A Google API error retries, then falls back to `NEEDS_LINK` on the final attempt (the `bulk-send-message` pattern,
      no DLQ).
  - A space created for an appointment cancelled in the meantime is left orphaned (harmless).
- **Backstop:** `sweep-pending-meetings` runs every 15 min. It moves `PENDING` older than 30 min to `NEEDS_LINK` and
  sends the held confirmation.
- **Reminder renderer:** a virtual reminder with no URL says "Te enviaremos el enlace por correo". Today it leaves a
  literal `{{5}}`.
- **Unblock virtual + bookable:**
  - Remove `VIRTUAL_NOT_BOOKABLE_MESSAGE` and its checks, and `VirtualLocationNotBookableError`.
  - Readiness counts any bookable location.
  - The public `bookableLocation` filter drops `isVirtual: false`.
  - `canReschedule` drops `!isVirtual`. A reschedule keeps the link and the status.
- **DTOs:**
  - The public location adds `isVirtual`.
  - `PortalAppointmentDto` adds `meeting: { status: 'ready', url } | { status: 'pending' } | null`. `NEEDS_LINK` shows
    as pending.
  - Update both key snapshots.
- **New endpoint `GET /v1/appointments/needs-meeting-link` (admin):** upcoming active `NEEDS_LINK` appointments, for
  the banner.
- **Tests:**
  - New `portal-virtual-booking.integration.test.ts`:
    - auto → `PENDING` + job on `tx`, with the confirmation held;
    - manual → `NEEDS_LINK` + the confirmation without a link;
    - a rollback drops the job;
    - a reschedule keeps the link;
    - the public `isVirtual`.
  - New `provision-meet.integration.test.ts`, with `vi.mock` of `src/google/google-meet.service.js`:
    - success → `READY` + the re-rendered reminder + the confirmation;
    - cancel while pending → skipped;
    - re-run → no-op;
    - token revoked → `NEEDS_LINK`;
    - API error → retry, then `NEEDS_LINK`;
    - the sweep.
  - Provider `PATCH` that adds a link:
    - `NEEDS_LINK` → `READY` + `patient-meeting-link`;
    - `PENDING` → `READY` + the confirmation;
    - a notes edit on `NEEDS_LINK` is OK;
    - clearing a `READY` URL is still 422.
  - Update the existing "virtual hidden / 400 both ways / 404" assertions.
  - Unit tests for `resolveMeeting` and the renderer fallback.
- **Bruno:** `Appointments/Needs Meeting Link`.

**PR 5.4-B — Portal: virtual booking UI.** Built (2026-11-02). As built: the drawer's "Falta el enlace" row has an
"Agregar enlace" button (opens the edit modal); the modal shows a hint instead of the required mark while the link may
wait; the banner names the next affected appointment and links to "Citas" (the list has no deep link yet). No drawer
test exists (as before).

As planned:
- **Provider:**
  - `LocationModal` stops disabling `bookableOnline` for virtual locations and drops the "más adelante" hint.
  - The readiness label becomes "Una ubicación disponible en línea".
  - The drawer shows "Enlace pendiente" / "Falta el enlace de la videollamada".
  - `AppointmentModal` doesn't require the URL when editing a `PENDING`/`NEEDS_LINK` appointment.
  - `ProviderAlerts` adds "N citas en línea necesitan un enlace de videollamada".
- **Patient:**
  - The booking page and form show "Videollamada" instead of an address.
  - The "Mis citas" card shows "Unirse a la videollamada" when the link is ready, or "El enlace de la videollamada
    llegará a tu correo".
- **Tests:** component tests only. CI e2e runs with the scheduler off and `e2e-publica` has no virtual location.

**Docs:**
- `AGENTS.md`:
  - The matrix rows.
  - Drop the "Meet path unexercised" gap.
  - Replace "Until 5.4…" with the meeting-status rules: only the portal path creates without a URL; Meet only from
    `provision-meet`, never inside a transaction; patients are notified through `onMeetingLinkSet`.
- `docs/operations.md`: the 8.2 (a) finding and the daily check job.
- 8.2 (d) is covered by the `NEEDS_LINK` banner, because provider-created virtual appointments always need a URL.

**Exit criteria for 5.4:**
- A patient can book and reschedule a virtual location.
- With Google connected, they receive a Meet link without provider action.
- Without Google, the provider sees the booking in the banner and drawer. Adding any link emails it to the patient.
- No email or reminder ever contains a literal placeholder.
- An expired Google connection shows up in the banner within a day, or right away with "Verificar ahora".

### Phase 6: Approval mode and review inbox
*Status (2026-11-03): all six PRs are built. The approval-mode Playwright project moved to 7.4. Test suites were not re-run for this status.*
- **6.1 `BookingRequest` model + holds.** Slot engine and lock count active holds. Tests: held slot not bookable, hold creation races with appointment creation. *(Built: migration `20261106000000_booking_requests`, `src/booking-requests/`.)*
- **6.2 Approval mode in the booking flow.** Provider setting, request creation carrying consent evidence, patient "pending confirmation" state.
- **6.3 Solicitudes inbox.** List and detail API and UI, approve and reject, Patient and `PatientConsent` created on approval, appointment created in the same transaction. Calendar shows dashed pending blocks.
- **6.4 Provider notifications.** Sidebar badge and dashboard card, outbound message on `reminderChannel`, new Twilio template. *(Built: `booking-request-notify` queue and worker registered in `scheduler/pg-boss.ts`; badge via `PendingRequestsContext`; `PendingRequestsAlert` in `ProviderAlerts`.)*
- **6.5 Expiry cron.** Release holds after about 48h, 24h nudge, patient expiry email. *(Built: `sweep-booking-requests` every 15 min, `purge-booking-requests` daily.)*
- **6.6 Review routing.** Inactive and deleted-only matches become requests; the inbox lists all deleted candidates for that normalized email; actions: restore one, create new, reject. *(Built: `review` flag from `resolvePortalPatient`, REVIEW holds in `portal-booking.service.ts`.)*

#### Phase 6 implementation plan (prepared 2026-11-02)
**Starting point (checked in code):**
- `User.bookingApprovalMode` exists (`schema.prisma:254`) but `updateBookingSettingsSchema` does not accept it and the Portal has no control for it. `requireSelfBooking` (`portal-booking.service.ts:47`) 404s unless `AUTO_CONFIRM`.
- `EntityType.BOOKING_REQUEST` and `ActionSource.PUBLIC_PORTAL` exist; there is no `BookingRequest` model.
- The slot engine already takes `busy.holds`; `public-booking.service.ts:149` hard-codes `[]` and `loadBusy` returns no holds.
- `renderBookingRequestReceivedEmail` exists and is unused. `portal-booking-notify` jobs are keyed by `appointmentId`, so requests need their own queue. `ensureCurrentConsent` stamps `acceptedAt = now`; approval must keep the original time.
- Latest migration: `20261105000000_appointment_meeting_status`.

**Decisions (defaults, prepared 2026-11-02):**
1. `holdExpiresAt = min(now + 48h, startAt)`. Slot engine and conflict checks ignore holds past `holdExpiresAt`, so correctness never depends on the cron; lists show such rows as EXPIRED.
2. A provider-created appointment over another request's live hold gets a neutral 409; the provider resolves the request first.
3. Approval re-checks overlap only (appointments, blocked time, other holds) via `createWithin`; it does not re-apply grid, lead or horizon.
4. Caps: 3 PENDING requests per email per provider, 50 per provider (neutral `PortalBookingLimitError`).
5. The request path never looks up patients and returns one response shape. The patient is resolved only on approval (reuse an active match, never modify it).
6. Reschedule stays blocked in approval mode (`canBook` already false); cancel works for appointments and pending requests.
7. Rejection email is neutral; provider notices carry no patient details.
8. Pending requests survive mode switches and paused booking and stay resolvable; approval does not need `isBookingLive`.
9. The approval-mode toggle ships in 6.3 with the inbox; do not offer it to providers before 6.4 and 6.5 are on staging.

**PR 6.1 — Server: model, holds, settings API (no patient-visible change).**
- Migration `20261106000000_booking_requests` (`--create-only`, read the SQL). `BookingRequest`: `id`, `userId`, `kind` (`NEW`; `REVIEW` reserved for 6.6), `status` (`PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED`), `emailHash`, encrypted `email`/`name`/`lastName`/`phone?`, type and location ids, `startAt`, `endAt`, `patientTimezone`, `holdExpiresAt`, `nudgedAt?`, consent evidence (`policyVersion`, `consentAcceptedAt`, `consentIp`, `consentUserAgent`), `resolvedAt?`, `resolvedBy?`, `appointmentId?`, `patientId?`. Indexes `(userId, status, holdExpiresAt)`, `(userId, emailHash, status)`, `(userId, startAt)`.
- Raw `booking_requests_no_hold_overlap`: `EXCLUDE USING gist ("userId" WITH =, tsrange("startAt","endAt",'[)') WITH &&) WHERE (status = 'PENDING')`. Add to the AGENTS.md raw-object list. Because it cannot use `now()`, creation first marks the provider's expired PENDING rows EXPIRED under the lock.
- Encryption: add the four PII fields to `ENCRYPTED_FIELDS` and `emailHash` to `BLIND_INDEXES`; check `backfill-pii.ts`.
- `src/booking-requests/` (repository, service, errors, constants): `createHoldWithin(tx, …)` (requires the lock), `expireStaleWithin`.
- `loadBusy` returns live holds with an `excludeRequestId` option; remove `holds: []`; `checkConflict` and the blocked-time check count holds.
- Settings API accepts, diffs and returns `bookingApprovalMode`.
- Tests: held slot hidden and unbookable, provider appointment over a hold 409, hold vs appointment `Promise.all` race, expired holds ignored and swept, 23P01 mapping, PII ciphertext at rest, settings audit.

**PR 6.2 — Server + Portal: request creation and patient experience.** *(Built 2026-11-02: `holdSlotWithin` and `portalRequestService` in `src/portal/portal-request.service.ts`, `resolveBookingMode`, 202 `{ request }`, `requests` in `GET /appointments`, `POST /requests/:id/cancel`, `approvalRequired` in the public profile; Portal `RequestSent`, `PortalRequestCard`, pending list with cancel. The receipt email is sent after commit with `sendTransactionalEmail`; the `booking-request-notify` queue stays in 6.4.)*
- `bookingMode(userId, tx)` replaces the 404 in `book` (reschedule still requires AUTO). The approval branch, in one transaction: lock → live → bookable type/location → `isSlotAvailable` with holds → caps → `createHoldWithin` → required `BOOKING_REQUEST` audit under `portalPatientAuditContext`. No Patient or consent row. Returns 202 `{ request: PortalRequestDto }` (allow-list: id, start/end, duration, type, location, `holdExpiresAt`, status). Public provider DTO gains `approvalRequired`.
- `GET /v1/portal/appointments` returns `{appointments, requests, consentRequired}`; requests are scoped by session `(userId, emailHash)` and always returned.
- `POST /v1/portal/requests/:id/cancel` (`portal-change-ip` + `portalSessionGuard`): lock → own PENDING → CANCELLED + audit; every miss is `PortalRequestNotFoundError` (404).
- Received email via `renderBookingRequestReceivedEmail`, after commit.
- Portal: `usePortalBooking` returns a union; `RequestSent` screen; "Enviar solicitud" label; "Solicitudes pendientes" in "Mis citas" with cancel through `ConfirmDialog`.
- Tests: creation, caps, same shape for matching and non-matching emails, no Patient/consent, cancel auth and cross-email 404, reschedule 404 in approval mode, hold released; Portal unit tests.

**PR 6.3 — Server + Portal: inbox, approve/reject, calendar, settings toggle.** *(Built 2026-11-02 together with 6.4–6.6: `booking-request-review.service.ts`, `/v1/booking-requests`, `createPortalAppointmentWithin`, `ensureCurrentConsent(..., acceptedAt)`; Portal `/requests`, `RequestDrawer`, calendar `PendingHoldBlock`/`PendingHoldChip`, `ApprovalSection`, shared `PendingRequestsProvider` for badge, alert and dashboard card. The `e2e-aprobacion` Playwright project moved to 7.4.)*
- `/v1/booking-requests` (provider auth, CSRF on writes, `requirePortalEnabled`, ADMIN/SUPER_ADMIN only): `GET /` (status tab, `from`/`to`, pagination, effective status), `GET /:id` (adds `existingPatient` computed at view time), `GET /count`, `POST /:id/approve`, `POST /:id/reject`.
- Approve: lock → PENDING and unexpired → resolve patient (reuse active match by `emailHash`, else create `source: PORTAL`, respect the cap) → `ensureCurrentConsent` with optional `acceptedAt` and request evidence → `createPortalAppointmentWithin` (extracted from `book`; meeting-pending, `provision-meet`, reminder; `excludeRequestId`) → APPROVED with ids → required audits → `enqueuePortalNotifications('booked', …)`. A conflict gives a neutral 409 and leaves the request PENDING.
- Portal: `/requests` page (`TabNav` Pendientes / Resueltas / Vencidas, `DataTable`, `RequestDrawer`), sidebar entry, third `requestHolds` list through the calendar hooks and views with `PendingHoldBlock`/`PendingHoldChip` (dashed, "Pendiente de revisión") and a legend swatch, `ApprovalSection` in `OnlineBookingTab.tsx`.
- Tests: atomic approve and full rollback on forced audit/consent failure, existing patient untouched, approve vs provider-created appointment race, reject releases slot, VIEWER 403, cross-tenant 404; Portal unit tests; e2e with a second seeded provider `e2e-aprobacion` in approval mode (`RequestsPage.ts`, `requests.spec.ts`, a `public` spec).

**PR 6.4 — Provider notifications.**
- Queue `booking-request-notify` (`{requestId, event: received | approved | rejected | expired | nudge}`), enqueued with `fromPrisma(tx)`, workers reread and skip stale states. Provider notice via `dispatchMessage` on `reminderChannel` (generic text, link to `/requests`). New `TWILIO_WHATSAPP_USER_PORTAL_REQUEST_SID` in `config.ts`, `.env.test`, `ci.yml` and `.env.example`. New rejected and expired patient templates.
- Portal: sidebar badge (`useFetchPendingRequestsCount`), `PendingRequestsAlert` in `ProviderAlerts` (admins, `portalEnabled`), dashboard `dash-card`.

**PR 6.5 — Expiry cron.**
- `sweep-booking-requests` every 15 min (like `sweep-pending-meetings`, `ActionSource.JOB`): flip expired PENDING to EXPIRED with audit and patient email; one provider `nudge` at about 24h (`nudgedAt`). The daily purge deletes non-PENDING requests older than 90 days.

**PR 6.6 — Review routing.**
- Deleted-only and inactive matches create a `kind = REVIEW` request in both modes; `portalAccessEnabled=false` stays a generic failure. Inbox detail lists all deleted candidates for the normalized email; actions: restore one (409 on unique collision), create new, reject. The patient learns only about their own record, which is accepted since they proved control of the email.

**Cross-cutting:** AGENTS.md gets the new rules in the same PRs; the Bruno collection is updated in the PR where each API becomes final (6.2 portal, 6.3 provider). Order: 6.1 gates all; 6.4, 6.5 and 6.6 follow 6.3.

### Phase 7: Provider controls and hardening
*Status (2026-11-03): built on `phase7/audit-quality-gates` (7.3-A, 7.3-B, 7.4-A, 7.4-B). Server integration, Portal unit tests and the local self-contained e2e run (`public`, `public-mobile`, provider `settings`/`patients`) pass. Changes from the plan below:*
- *7.4-A uses `buildPortalApp()` (the real public/session routers), not the real `app`: `.env.test` keeps `ENABLE_PORTAL=false`. The "429 before parsing" check holds only for the class limiters (`public-ip`/`portal-ip`). The named limiters run after the 10kb parser. Uniform OTP responses and token separation were already covered and were not duplicated.*
- *7.4-B creates the deleted review patient per run through the provider API (create + delete) instead of seeding it, so retries and reruns are independent of seeded state. The seed adds only `e2e-aprobacion`, gives both portal providers `ADMIN_PASSWORD` and clears their booking requests.*
- *The e2e job sets `PUBLIC_RATE_LIMIT_MAX` (the coarse 60/min `public-ip` limit tripped locally once the new specs ran).*
- **7.3 Audit view** for portal-originated actions.
- **7.4 Quality gates.** Playwright e2e for booking, cancel and review flows in `Portal/e2e`, and abuse and rate-limit tests. Includes the approval-mode e2e deferred from 6.3: a second seeded provider `e2e-aprobacion` in approval mode (`RequestsPage.ts`, `requests.spec.ts`, a `public` spec).

#### Phase 7 implementation plan (prepared 2026-11-03)
**Starting point (checked in code):**
- **Portal actions are already audited.**
  - `portalPatientAuditContext` (`src/audit-log/audit-actors.ts`) stamps `source = PUBLIC_PORTAL`, `actorId = portal:<24 hex of portalActorHash(userId, email)>` and `actorDisplayName = "Paciente (portal) <masked email>"`.
  - Booking, cancel, reschedule, consent and request create/cancel write required audits on `tx`. Expiry runs as `source = JOB` (`bookingRequestExpiryAuditContext`).
- **The API already filters.** `GET /v1/audit-logs` (`authenticate` + `requireAdminForWrites`, so VIEWER can read) filters by `entityType[]`, `actionType[]`, `entityId`, `actorId`, dates and a single `source`.
  - `search` decrypts at most 1000 rows in memory. `actorDisplayName`, `description`, `ipAddress` and `fieldsBefore`/`fieldsAfter` are ciphertext.
- **The UI.** Settings → "Registro de actividad" (`AuditLogsTab.tsx`, `AuditDrawer.tsx`) has action, entity, date and `entityId` filters. `AppointmentDrawer` deep-links with `entityId`. There is no source filter or source column.
- **Bug: the tab crashes on portal rows.**
  - The Portal `EntityType` (`src/types/AuditLog.ts`) has no `BOOKING_REQUEST` or `PATIENT_CONSENT`.
  - `EntityTypePill` reads `ENTITY_TYPE_CONFIG[...]` without a fallback, so the first consent or request row throws a `TypeError` while rendering. Every first portal booking writes a consent row.
  - Both values are also missing from the entity filter.
- **The drawer lacks portal detail.**
  - `FIELD_LABELS` has no portal fields (`policyVersion`, `kind`, `acceptedAt`, `holdExpiresAt`, `cancelledBy`, `patientRescheduleCount`, `meetingStatus`, `patientTimezone`).
  - Enum values (`PENDING`, `CANCELLED`, `PATIENT`) show raw.
  - `formatValue` calls `fmtDateTime(value)` without the display timezone, which AGENTS.md forbids in React components.
- **E2E today.**
  - Projects: `setup`, `chromium`, `mobile`, `public`, `public-mobile`, with `workers: 1` and `retries: 2`.
  - Public specs: `book`, `booking` (auto-confirm book → reschedule → cancel), `portal-login`, `public-pages`.
  - The seeded `e2e-publica` provider has a random password, so no spec can log in as it.
  - `auth.setup.ts` covers only the SUPER_ADMIN e2e user.
- **The OTP budget is tight.** `otp-request-ip` allows 10 per IP per 15 minutes, shared by every project and retry. Today's specs use 4: two specs in two projects.
- **Abuse coverage today.**
  - `portal-otp.integration.test.ts`: OTP domain limits (cooldown, per-provider hourly cap, `failedCount`).
  - `portal-booking-request.integration.test.ts`: request caps.
  - `public-api.integration.test.ts`: the generic limiter's 429, on a synthetic router.
  - Not covered: the named limiters mounted in the real app (`otp-request-ip` 10, `otp-verify-ip` 20, `portal-booking-ip` 10, `portal-change-ip` 10, `public-ip`/`portal-ip` at `PUBLIC_RATE_LIMIT_MAX`).
  - The Hardening rule "add a test that no public route reads tokens from path/query" has no test.

**Decisions (defaults, prepared 2026-11-03):**
1. 7.3 extends the existing activity log. It adds no new page and no new audit writes.
2. Per-patient portal activity uses a stable link: `AuditLog.portalPatientId`, bound when a portal action resolves (or creates) its patient record.
   - Revised after review (2026-11-04). Matching only by the actor id of the *current* email lost history after an email change, and it mixed records that share an email (a deleted one and its replacement).
   - Unlinked rows (OTP logins, booking requests, older rows the migration could not backfill) still match the current email's actor. The UI hint says so.
   - The actor-id formula lives in one helper, used by both the writer and the filter.
3. VIEWER read access to the log stays as it is (see Open).
4. Approval and review e2e run only in the desktop `public` project.
   - The OTP budget becomes 6 of 10, leaving 4 for retries.
   - Abuse and rate-limit checks are integration tests (supertest on the real app). E2E must never trip a limiter.
5. Provider-side e2e logs in as the seeded portal providers, never as the shared SUPER_ADMIN user. Holds and portal rows then stay off the `chromium` calendar.
   - The portal providers reuse `ADMIN_PASSWORD`, so CI gets no new variables. The seed's database-name guard still applies.

**PR 7.3-A — Server + Portal: fix the crash, source filter, drawer labels (ship first; small).**
- Portal `EntityType`/`ENTITY_TYPE_CONFIG`: add `BOOKING_REQUEST` ("Solicitud de reserva") and `PATIENT_CONSENT` ("Consentimiento").
  - `EntityTypePill` and `ActionPill` fall back to a neutral pill showing the raw value, so a server enum can grow before the Portal does.
- Server: `listAuditLogsSchema.source` accepts one value or an array (`in`), like `entityType`.
- Portal source filter:
  - `QUERY_PARAMS.auditSource`, plus an "Origen" enum filter column: API, Tarea, Portal de pacientes.
  - The "Origen" column shows the source; no separate "Portal" chip (dropped after review: it repeated the column).
  - The `entityId` chip pattern is reused for active filters that have no column.
- `AuditDrawer`:
  - Spanish labels for the portal fields.
  - Value labels for `status`, `cancelledBy`, `meetingStatus`, `kind` and `source`.
  - Values formatted by field: full ISO instants with `fmtDateTime(value, timezone)`; calendar days (`dateOfBirth`, `birthDate`, bare `YYYY-MM-DD`) with `fmtCalendarDay`; `policyVersion` verbatim.
- Tests:
  - Server integration: array `source` filter, plus `PUBLIC_PORTAL` rows from a real portal cancel are listed with `source=PUBLIC_PORTAL`.
  - Portal unit: pill fallback, new labels, source filter → query.
- Bruno: `Audit Logs/List Audit Logs` documents the array `source`.

**PR 7.3-B — Server + Portal: per-patient portal activity.**
- Extract `portalActorId(userId, email)` from `portalPatientAuditContext` and use it in both places.
- `listAuditLogsSchema` gains `portalPatientId` (uuid). Sending it together with `actorId` returns 400.
  - The repository loads the patient scoped by `userId`, deleted patients included (history matters), decrypts the email and filters by `actorId = portalActorId(userId, email)`.
  - A foreign or unknown id, or a patient without an email, returns an empty page: the same semantics as any other filter, never 404.
- Portal `PatientDrawer`: "Actividad en el portal" link to `/settings?tab=Registro+de+actividad&portalPatientId=<id>` (the filter implies `PUBLIC_PORTAL`).
  - Shown when `portalEnabled`. Linked rows outlive the patient's email.
  - On the tab, a "Paciente ✕" chip clears it, with a hint that logins and requests are found by the current email.
- `RequestDrawer` gets "Ver registros de actividad" (`entityId = request.id`), like `AppointmentDrawer`.
- Tests:
  - Integration:
    - Only the patient's own portal rows are returned, not another patient's with the same provider.
    - Another tenant's patient with the same email returns an empty page.
    - After an email change, the old rows are not matched.
    - `portalActorId` equals the actor written by a real portal cancel.
    - Both filters together return 400.
  - Portal unit: link visibility.
- Bruno: `portalPatientId` in `List Audit Logs`.

**PR 7.4-A — Server: abuse, rate-limit and URL-secret tests (tests only; production code changes only if a test finds a gap).**
- New `test/integration/app/portal-abuse.integration.test.ts`, supertest on the real `app` with `ENABLE_PORTAL` on, like `public-api.integration.test.ts`.
  - `trust proxy` is one hop, so each test sends its own `X-Forwarded-For` IP. The in-memory buckets then never bleed between tests.
- `otp-request-ip`:
  - 10 requests with the test CAPTCHA token get the uniform 202. The 11th gets a JSON 429.
  - The blocked request writes no `PortalOtp` row and makes no Brevo `fetch` (the limiter runs before parsing and CAPTCHA).
  - Another IP still gets 202.
- The other limiters:
  - `otp-verify-ip`: 20 attempts, then 429.
  - `portal-booking-ip`: 10, then 429.
  - `portal-change-ip`: one bucket shared by appointment cancel, reschedule and request cancel. 10 mixed calls, then each of the three is 429.
  - `public-ip`/`portal-ip` at the configured maximum.
- On a blocked IP, an oversized or malformed body is still 429 (not 413/400), and the response has no `Set-Cookie`.
- Uniform responses:
  - OTP request for an unknown slug, a live slug with an existing patient's email and one with a new email: identical status, body and headers, ignoring `Date`, `RateLimit-*` and the request id.
  - Add this only where `portal-otp.integration.test.ts` lacks a byte-level comparison.
- No secrets in URLs:
  - Walk the stacks of `createPublicApiRouter()`/`createPortalSessionRouter()`. Assert no route path has a `:token`, `:code`, `:challenge` or `:otp` parameter.
  - `otp/verify` with `code`/`challenge` only in the query string is 400 (they are body-only).
- Token separation (provider JWT in `portal_session`, portal JWT as provider Bearer, wrong audience): extend `portal-session.integration.test.ts` only for cases it misses.

**PR 7.4-B — E2E: approval mode and review routing.**
- Seed (`seed-e2e.ts`, idempotent):
  - New `E2E_SEED` ids: `approvalSlug = 'e2e-aprobacion'`, `approvalProviderEmail = 'e2e-approval-provider@example.com'`, and type and location ids `…c1`/`…c2`.
  - The approval provider: `bookingApprovalMode: REQUIRE_APPROVAL`, the same weekly availability, `reminderChannel: EMAIL`. Both portal providers get `config.admin.password`.
  - On `e2e-publica`, one soft-deleted patient `e2e-revision@example.com`, written through the extended client so ciphertext and `emailHash` are right. Every seed sets `isDeleted: true` again.
  - On every seed, delete both portal providers' `BookingRequest` rows, so local reruns never reach the per-email (3) or per-provider (50) caps. CI is fresh anyway.
- Shared helpers:
  - `e2e/support/portal.ts`: `inbox`, `latestCode`, the Vercel-header strip route and `loginWithOtp`, extracted from `booking.spec.ts`/`portal-login.spec.ts`.
  - `e2e/support/provider-context.ts`: opens a second `browser.newContext()` and logs in with `LoginPage`. The `public` project keeps running without the `setup` dependency.
- `pages/RequestsPage.ts` (POM):
  - Tabs Pendientes/Resueltas/Vencidas, and rows.
  - Drawer actions: `request-approve`, `request-reject` (+ `ConfirmDialog`), `request-choice-restore-<id>`, `request-choice-new`.
  - Outcomes: `request-done`, `request-review-reason`.
- `tests/public/approval.spec.ts` (desktop only, one OTP):
  - Patient: on `/book/e2e-aprobacion`, "Enviar solicitud" shows the `RequestSent` screen. An anonymous reload no longer offers that time (hold).
  - Patient: "Mis citas" lists it under "Solicitudes pendientes". Cancelling it through `ConfirmDialog` releases the time.
  - Patient: sends requests A and B at different times.
  - Provider: `/requests` Pendientes shows both, and the sidebar badge shows 2. The "received" notices in the mock inbox contain no patient name.
  - Provider: approving A moves it to Resueltas, and it appears on the calendar. Rejecting B goes through `ConfirmDialog`.
  - Patient: after a reload, A is under "Próximas citas" and B is gone. The approved and the neutral rejected emails arrived.
  - Cleanup: the patient cancels A.
- `tests/public/review.spec.ts` (desktop only, one OTP, `e2e-revision@example.com` on auto-confirm `e2e-publica`):
  - Patient: "Reservar cita" shows the request-sent screen (202 review), not a confirmation.
  - Provider: the request shows the deleted candidate and `request-review-reason`. The provider chooses "Restaurar a …" and approves.
  - Patient: "Mis citas" shows the appointment.
  - Cleanup: the patient cancels it. The next seed deletes the patient again.
- Budget:
  - Totals: login 2 + booking 2 + approval 1 + review 1 = 6 OTPs per run. Note it in `playwright.config.ts` and the AGENTS.md e2e line.
  - The `public-ip` coarse limiter (60/min) is untouched. If CI shows 429s, set `PUBLIC_RATE_LIMIT_MAX` in the e2e job's `env` only.
- `requests.spec.ts` in `chromium` is dropped from the original 6.3 list. The inbox needs a portal provider, so it lives in the two specs above.

**Cross-cutting:**
- AGENTS.md:
  - Portal actor ids come only from `portalActorId`.
  - The e2e line names `e2e-aprobacion`, the review patient and the OTP budget.
  - Abuse tests use a distinct `X-Forwarded-For` per test.
- Order: 7.3-A first (it fixes a crash that every provider with portal activity hits), then 7.3-B. 7.4-A and 7.4-B are independent of 7.3 and of each other.

**Phase 7 exit criteria:**
- The activity log renders every entity type, can be narrowed to portal actions and to one patient's portal activity, and shows portal fields in Spanish.
- The approval and review flows pass e2e on a fresh CI stack within the OTP budget.
- Every named public limiter has an app-level 429 test.
- The no-secrets-in-URLs rule has a test.
- Bruno and AGENTS.md match the code.

**Decided:**
- VIEWER keeps read access to portal rows, masked emails and IP addresses included (decided 2026-11-06).
- Providers do not need a consent history per patient (decided 2026-11-06).

### Phase 8: Operational follow-ups (not portal features; can start any time)
- **8.1 Encryption key rotation:** moved to 10.10.
- **8.2 Google Meet connection UX.** *(Done 2026-11-02: (a)–(e) built and the manual (a) check completed.)* Originally: today the connection expires silently. The refresh token's death (`invalid_grant`, `src/google/google-meet.service.ts:28`) is only discovered when the provider clicks "Generar Google Meet": then the connection is marked disconnected and the modal switches to "Reconectar". Until that moment `GET /v1/google/connection` reports `connected: true` from the stored row, so Settings and the appointment modal show a healthy connection that isn't. Build:
  - (a) **Find the cause first.** If the OAuth consent screen is in "Testing" publishing status, Google expires refresh tokens after 7 days; moving it to "In production" (with verification for the Meet scope if required) fixes the root cause. Also check password changes, the 50-token-per-client limit and user revocation. Record the finding in `docs/operations.md`.
  - (b) **Check validity proactively.** A daily pg-boss job (and an optional `?verify=true` on the status endpoint, rate-limited) refreshes the access token for each active connection. On `invalid_grant` it reuses the existing mark-disconnected + audit path. Requires `ENABLE_SCHEDULER`; without it the status endpoint check is the only signal.
  - (c) **Tell the provider before they need it.** A persistent banner in the provider layout ("Tu conexión con Google expiró. Reconéctala para generar enlaces de Meet.") with a one-click reconnect, an outbound notice on the provider's `reminderChannel` when a connection is lost, and a status in Settings that distinguishes "connected", "expired, reconnect" and "never connected" (with `lastUsedAt`/last checked time).
  - (d) **Flag affected appointments.** Upcoming virtual appointments with no `meetingUrl` (or created while disconnected) are listed in the banner/dashboard so the provider can add links before reminders go out.
  - (e) In the appointment modal, show the expired state up front instead of after a failed click, and keep the manual URL field usable either way.
  - Tests: `invalid_grant` from the check job marks the connection disconnected and audits once; status endpoint returns the expired state; the banner renders from that state; reconnect clears it. Google is mocked at `src/google/google-meet.service.js`; no network calls.
  - **Dependency:** 5.4 (portal virtual bookings) relies on the same signal for its `FAILED` fallback and provider notification, so build 8.2 (b)–(c) before 5.4.
  - **Prepared 2026-11-02** together with 5.4 (see "5.4 + 8.2 (a)–(c) implementation plan" under Phase 5). Changes from
    the text above: alerts are in-app only (no outbound notice on `reminderChannel`); (d) is covered by the
    `NEEDS_LINK` banner; (e) is included.

### Phase 9: All channels for patient login and messages
*Status: 9.1–9.4 built 2026-11-05. The `ENABLE_PORTAL_PHONE_LOGIN` flag was removed the same day: phone login is always on with the portal. All templates were assumed to exist; the SIDs are required at boot. SMS was dropped from login the same day: the login offers email and WhatsApp, and SMS stays for reminders and notices. Text below about SMS codes describes what was first built.*

**Still to do:** moved to Phase 10 (10.1, 10.8 and 10.9).

**Decided while building:**
- `patient-meeting-link` reuses the existing template, as `{1: provider, 2: url}`, so there is no eighth template.
- "Several active" counts trusted records only: one trusted record plus an unverified one is that patient. Otherwise anyone typing a number into a form could lock out its real holder, which is what decision 3 asks for.
- The flag clears on an inbox pick only when the request proved that same number. A pick on an email request, or on a record matched by another number, says nothing about a typed phone.
- With no pick, a phone request reuses only a single trusted record, otherwise it creates a new patient. Restoring a deleted record is allowed alongside active ones sharing the number, since only email is unique.
- The backfill skips patients already on `reminderChannel = WHATSAPP`: the provider already endorsed that number, by the same rule that clears the flag.
- The login always offers email and WhatsApp: there is no setting to leave one out.
- `?portalPatientId=` leaves out an unverified number's actor, so a stranger's activity never shows under a record they typed a number into. On a shared, trusted number the unlinked rows show under every record holding it: the provider sees them either way, and they carry no PII.
- An active revoked record fails closed for the whole number even when its number is unverified, as the table says. Trusting it less would let a revoked patient get a new record by logging in with that number.
- Portal SMS reminders are one short line. WhatsApp reminders keep the approved template, which greets by name; removing that needs a new template.

**Goal:** a patient can receive the login code by email, WhatsApp or SMS, and every later portal message (confirmation, cancellation, reschedule, meeting link, request receipt, rejection, expiry and reminder) reaches them on their own channel. All of these are email-only today.

**Why this is more than new templates:** email is the portal's identity, not only its transport. The session, the OTP row, booking requests, patient matching and the audit actor are all keyed on it. A phone login has to answer who a number belongs to, and numbers are shared and typed without proof in ways emails are not. The gain is real: `Patient.reminderChannel` defaults to `WHATSAPP`, and a patient with no email cannot use the portal at all ("Known limitation" under "Session and matching").

#### Phase 9 implementation plan (prepared 2026-11-04)
**Starting point (checked in code):**
- **Messages.** Provider notices are already multi-channel (`dispatchMessage`, `providerDestination`). Both `patientMessage` functions (`portal-booking-notifications.ts`, `booking-request-notifications.ts`) hard-code `Channel.EMAIL`, and the request receipt in `portal-request.service.ts` calls `sendTransactionalEmail` directly.
- **Reminders.** `portalReminder` already takes a channel, but both callers pass only the session email. `send-reminder` and the renderer already handle WhatsApp (quick-reply templates) and SMS, so reminders need routing only.
- **Phones.** `whatsappNumber` and `smsNumber` are encrypted, and `whatsappHash` and `smsHash` use the same `phoneHash`, so one number hashes the same in both. They are indexed per provider but not unique: a family can share a number.
- **Typed numbers.** `createPortalPatient` and request approval write the booking form's unverified phone to `Patient.whatsappNumber`.
- **Identity spread.**
  - `PortalTokenClaims.email`, about 15 `session.email` call sites, and `PortalOtp.emailHash`.
  - `BookingRequest.email` (required) and `emailHash`.
  - `portalActorHash`, and `audit-log.service.ts:13`, which finds no actor for a patient without an email.
- **Delivery status.** `sendWhatsApp` and `sendSms` report only that Twilio accepted the message. The status callback looks up `Reminder.messageId` and ignores any other SID, so a number without WhatsApp (63024) fails after the send, and neither the OTP nor a portal notice learns about it. Errors raised at send time (21610, STOP) do reach the worker.
- **Senders.** There is one `TWILIO_WHATSAPP_FROM` and one `TWILIO_SMS_FROM` for all providers.
- **E2E.** There is no Twilio mock, and the client has no configurable base URL.

**External constraints (from Twilio's docs, 2026-11-04; recheck before submitting templates):**
- The [WhatsApp OTP template](https://www.twilio.com/docs/content/whatsappauthentication) must be the `whatsapp/authentication` type. Meta fixes the body, a Copy Code button is required, Twilio does not support the autofill button, and the expiry footer takes 1-90 minutes. **The code message cannot name the provider**; the patient sees only the platform's WhatsApp sender name.
- [Colombia SMS](https://www.twilio.com/guidelines/co/sms): a global number can reach Colombian phones, but the sender is overwritten with a short code, so patients cannot recognize the sender and the body must say what the code is for. The sender-type table needs a direct read; third-party guides say alphanumeric IDs are not kept, and the page lists a 4-10 week provisioning time for some sender type.
- [SMS pumping](https://www.twilio.com/en-us/blog/migrate-programmable-messaging-to-verify): Programmable Messaging offers SMS Pumping Protection as something we configure ourselves. Verify includes it. Unlike email, every OTP now costs money per send, and it can be triggered anonymously.

**Decisions (defaults, prepared 2026-11-04; these revise "Scope decisions"):**
1. **Login identity is a verified contact, email or phone.** The patient chooses the channel at login. WhatsApp and SMS prove the same number, so they share one OTP row, one cooldown and one failure count.
2. **OTP request still never looks up patients.** Numbers with no patient get a code too, the same as unknown emails today: it is how a new patient signs up, and it keeps the 202 uniform.
3. **A phone matches only when exactly one trusted active record has it.** Several active matches do not auto-pick: the booking becomes a `REVIEW` request and the list stays empty. A "who are you?" picker would show one family member's name, and the fact that they are a patient, to whoever holds the phone.
4. **Typed numbers are never an identity.** A number from the booking form is flagged `whatsappUnverified` until the provider endorses it. Otherwise a typo would let the real holder of that number log in and see someone else's appointments. A flagged match goes to review, so nothing auto-links.
5. **Phone sessions never collect an email.** A typed email would become a login identity, and it could hit `patients_userId_emailHash_active_key`, revealing that the patient exists. This mirrors today's rule that the email comes from the session.
6. **Keep our own `PortalOtp`; do not move to Twilio Verify.** One code path keeps the challenge, the daily failure cap and all limits under `lockRow`, for every channel. Verify would take over code generation and checking for phones only. Revisit if pumping protection on Messaging falls short.
7. **One route for every patient message.** It follows `Patient.reminderChannel`, since the provider already set that per patient. A patient has no preference screen in this phase, because "the portal never updates an existing Patient".
8. **No automatic fallback in this phase.** At login the patient recovers with email. For later messages the appointment still shows in "Mis citas", and a failed reminder still alerts the provider. See Open.
9. **Message text is minimal.** SMS is not end-to-end encrypted and both channels show on lock screens. Messages carry the provider's name, the time and the place or link, never the appointment type, notes or the patient's name.

**9.0 — Prerequisites (no code; start first, they have lead time).**
- Approve the WhatsApp templates below, in Spanish, `utility` except the OTP. Times must not be followed by a full stop (they end in "a. m."/"p. m."), and a variable can never be empty, so a missing link uses the "link will follow" text.

| Env var | Used for | Variables |
|---|---|---|
| `TWILIO_WHATSAPP_PATIENT_PORTAL_OTP_SID` | Login code (`whatsapp/authentication`, 10 min) | code |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_CONFIRMATION_SID` | Booked, approved, meeting ready | provider, date, time, place |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_CANCEL_SID` | Cancelled | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_RESCHEDULE_SID` | Rescheduled | provider, previous date and time, new date, new time, place |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_REQUEST_RECEIVED_SID` | Request receipt | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_REQUEST_REJECTED_SID` | Request rejected (neutral) | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_REQUEST_EXPIRED_SID` | Request expired (neutral) | provider, date, time |

- `patient-meeting-link` reuses `TWILIO_WHATSAPP_PATIENT_APPOINTMENT_MEETING_LINK_SID` if its variables fit; otherwise it becomes an eighth template.
- Send real test WhatsApp codes to the main Colombian carriers. Confirm delivery, delay and how the sender appears.
- In the Twilio Console: a usage alert, and Geo Permissions on for every country that receives SMS reminders.
- Counsel confirms the policy covers login codes over WhatsApp and SMS. It names Twilio and SMS/WhatsApp "por instrucción de la clínica", but not Meta and not phone login. Any text change bumps `PRIVACY_POLICY_VERSION`, so every patient accepts again once.

**PR 9.1 — Server: patient message routing (no login change).** Useful on its own: existing patients get portal messages on their WhatsApp or SMS.
- Migration (`--create-only`, read the SQL): `Patient.whatsappUnverified Boolean @default(false)`.
  - Backfill to true where `source = 'PORTAL'` and `whatsappHash` is set. This only reads a hash column, not ciphertext.
  - Set by `createPortalPatient` and approval whenever a typed phone is written.
  - Cleared when the provider changes the number, sets `reminderChannel = WHATSAPP`, or picks the record in the inbox. No new endpoint.
- `resolvePatientRoute(patient)` (`src/portal/patient-route.ts`) returns `{ channel, to }` or null:
  - the address for `reminderChannel`, if present;
  - otherwise email, then the WhatsApp number if not flagged, then SMS;
  - null means skip and log, as "no address" does today.
- `renderPatientNotice(kind, params, channel)` (`src/portal/patient-notices.ts`) returns `DispatchOpts`. Email keeps the current templates, WhatsApp uses the SIDs above, and SMS gets one short Spanish line. It replaces both `patientMessage` bodies and the request receipt.
- Reminders: `createPortalAppointmentWithin` and `reminderPatch` take the route instead of an email. A null route creates no reminder. The settled-reminder replacement uses the route, not always email.
- Job payloads stay ids only. The worker reads contact fields when it delivers, so a changed number is honored and rollback still removes jobs.
- **Behavior change to expect:** an existing patient on `reminderChannel = WHATSAPP` who logs in with email now gets WhatsApp, not email. New portal patients stay on `EMAIL`.
- Config: six `requireEnv` SIDs (all but the OTP) in `.env.test`, `ci.yml`, `.env.example` and `Server/.env`. **This PR cannot deploy until those templates are approved.**
- Tests:
  - Integration: each patient kind on each channel; route order; a flagged number is never messaged; a request rejected or expired still goes to its contact; reminders on the routed channel; a failed send throws for retry.
  - Unit: no notice contains the appointment type, the patient's name, or a full stop after a time.

**PR 9.2 — Server: contact identity, still email only (refactor; no behavior change).** Merge alone so that 9.3 is a small diff.
- `PortalContact = { channel: Channel, value: string }`, with `contactHashOf` and `isPhoneContact`. `PortalSessionContext` carries `contact` in place of `email`.
- Token claims: `{ userId, sid, channel, email? | phone? }`, exactly one contact. A token with only `email` reads as `channel: EMAIL`, so deploying logs nobody out.
- `PortalOtp`: rename `emailHash` to `contactHash` and add `channel Channel @default(EMAIL)`.
  - **Edit the generated SQL to `RENAME COLUMN`.** Prisma generates a drop and add for a rename.
  - The code hash context stays `${userId}:${hash}`, so codes in flight keep working.
- `BookingRequest`:
  - `email` becomes nullable.
  - Add `contactChannel Channel @default(EMAIL)`.
  - Add `verifiedPhone` (encrypted `TEXT`) with blind index `verifiedPhoneHash`, in `ENCRYPTED_FIELDS` and `BLIND_INDEXES`.
  - Ownership, caps and `requests` use `ownRequestWhere(session)`. **The typed `phone` is never queried**: an email session could type someone else's number, and it must not appear in that number's list.
- Audit:
  - `portalActorHash(userId, contact)`. The email branch stays byte-identical, or old rows stop matching.
  - `audit-log.service.ts` builds actor ids from the patient's email and both numbers, so `?portalPatientId=` needs `actorId IN (...)`.
- Tests: the existing OTP, session, booking, request and audit suites pass unchanged in meaning. Add: a legacy email-only token still works, and the actor id for an email equals the pre-refactor value.

**PR 9.3 — Server: phone OTP and phone patients.**
- `POST /v1/public/providers/:slug/otp`: body `{ email, captchaToken }` stays valid, plus strict `{ phone, channel: 'WHATSAPP' | 'SMS', captchaToken }`. E.164 only, same CAPTCHA action and limiter.
- Limits on the row under `lockRow`, starting values:
  - per number: 3 sends per hour, sharing the row's cooldown and `failedCount`;
  - per provider, paid channels: `perProviderPaidPerHour` 30;
  - across all providers: `PORTAL_OTP_PAID_DAILY_CAP` 300, counting rows, which is what number-rotating pumping inflates. It can overshoot slightly under concurrency, like the existing provider cap.
  - A hit cap answers the usual 202 and logs at error level without PII, so Sentry shows an attack or a limit that is too low.
- Every country is allowed: any E.164 number can request a code, and the caps above bound the cost.
- `sendPortalOtp(contact, code, provider)` runs after commit and never throws, like `sendTransactionalEmail`. It logs `maskedTo`, never the code or `contentVariables`. The SMS text says what the code is for and for which provider, because the sender is overwritten.
- `POST /v1/portal/:slug/otp/verify`: `{ email | phone, code, challenge }`. The session's channel comes from the row, never the client. A resend on the other channel replaces the code and the channel.
- `resolvePortalPatient` and `findPortalMatch` for a phone contact, over `whatsappHash` or `smsHash`:

| Matches | Result |
|---|---|
| Any active match with `portalAccessEnabled=false` | `unavailable`, `review: false` (fail closed for the whole number) |
| One active, trusted | Same as email |
| Several active | `unavailable`, `review: true` |
| Only `whatsappUnverified` matches | `unavailable`, `review: true` |
| Deleted only, or none | Same as email |

- New patient from a phone session: the number goes in `whatsappNumber` or `smsNumber` by channel, `reminderChannel` is that channel, `whatsappUnverified=false`, no email. `resolve` runs under the provider lock, so concurrent bookings cannot create two records.
- Booking body: a phone session sending `patient.phone` gets 400; the number comes from the session.
- Inbox: `findCandidates` searches by the request's verified contact. Add `existingPatientId` beside `restorePatientId`, so the provider can pick among active candidates. Picking a flagged record clears the flag.
- `GET /v1/public/providers/:slug` gains `loginChannels` (`['EMAIL']` while the flag is off). `GET /v1/portal/session` gains `contactChannel` and `contact`; `email` stays, nullable, until 9.4 ships.
- Tests (`portal-otp` and `portal-booking` suites, Twilio mocked at `src/twilio/client.js`):
  - Byte-identical 202s for a new number, a patient's number and a revoked number.
  - Each paid limit answers 202 without sending, and WhatsApp plus SMS share the row's limits.
  - A code is never stored, logged or passed to the logger in plain form.
  - A number from any country gets the usual 202.
  - Each row of the table above, plus list and consent responses identical across outcomes.
  - An email session's typed number never matches a phone session (patient and request).
  - The review flow with shared numbers, and two concurrent phone bookings creating one patient.
  - Audit rows for a phone session link to the patient, and `?portalPatientId=` finds a patient with no email.

**PR 9.4 — Portal: login and provider labels.**
- `PortalLogin`: a channel choice from `loginChannels`, hidden when only email is offered. The phone step reuses `normalizePhone`/`isE164`, with `autoComplete=tel` and neutral copy ("Si el número es válido, te enviamos un código"). `SESSION_LOST_NOTICE` and the default lead stop saying "correo".
- Code step: after the 60s countdown, offer "Reenviar código" and "Enviar por SMS" or "Enviar por WhatsApp", each with a fresh CAPTCHA token. Keep the existing rule that returning to the same contact goes back to the code step without a request: a request inside the cooldown returns a throttled random challenge and breaks the code already sent.
- `BookingForm`: a phone session hides the phone field and shows no email field.
- Provider side: `RequestDrawer` handles a null email and marks the phone as verified, and offers active candidates. `PatientDrawer` shows "Número sin verificar" for a flagged record.
- Tests: component tests for the selector, a phone-only session in the booking form, and the channel switch resetting the widget.
- E2E: keep the budget of 6 OTPs. The flag stays off in CI, so assert only that the selector is absent. Phone login has no e2e because there is no Twilio mock; integration tests cover it, plus a manual check on a real phone before turning the flag on.

**Cross-cutting:**
- Bruno, in the PR where each change becomes final: Request OTP and Verify OTP phone bodies, `loginChannels`, the session fields, the request's nullable email and `existingPatientId`.
- AGENTS.md, in the same PRs: `PortalContact` as the session identity; patient messages only through `resolvePatientRoute`; typed numbers are never identities; own requests only through `ownRequestWhere`; a paid-channel limits line; the new `requireEnv` SIDs. Update the rules that today say "email", including the OTP section and "replaced by a new email reminder".
- `docs/operations.md`: template list, Twilio Console settings, the caps and how to change them. `docs/compliance-patient-data.md`: `verifiedPhone`, and Meta as a recipient of WhatsApp traffic.
- Order: 9.0 runs in parallel from the start. 9.1 (needs six templates), then 9.2, then 9.3 (needs the OTP template), then 9.4. Reach production only after the manual check.

**Phase 9 exit criteria:**
- A patient with no email can log in, book, and receive every message on WhatsApp or SMS.
- An email login behaves as before, and existing sessions and audit links survive the deploy.
- No response reveals whether a number belongs to a patient.
- An unverified number can neither log in to a record nor receive portal messages.
- A shared number never auto-selects a record.
- Paid OTP sends are capped per number, per provider and overall, and hitting a cap is visible in Sentry.
- Bruno, AGENTS.md and both docs match the code.

**Decided:**
- **Families share one contact (decided 2026-11-06).** There is no record picker. A shared number goes through review every time and shows an empty list by phone. A shared email resolves to the one record that holds it.
- **Asynchronous delivery failure.** A portal notice to a number without WhatsApp fails silently (63024). There is no failover to another channel (decided 2026-11-06).

### Phase 10: Remaining work
*Status: this is the single list of remaining work, checked against the code on 2026-11-06. Everything outside this phase is built or decided. All built work is on `main`, and the portal is not enabled in production. Phone login cannot be separated from the portal, so 10.1 to 10.8 gate enabling it, including for any pilot.*

**Legal and compliance (before enabling; owner: controller, with counsel).**
- **10.1 Counsel review of the policy.** The update was drafted on 2026-11-06 (WhatsApp login, Meta, rescheduling, consent evidence, 90-day request retention; `PRIVACY_POLICY_VERSION` `2026-11-06`). Questions for counsel: Meta's role; the revocation wording in section 10; whether sensitive data needs its own checkbox; WhatsApp reminders greeting the patient by name, with the address and instructions; and minors whose booking lands on a parent's record through a shared contact. If the text changes, update `PRIVACY_POLICY_VERSION` and `lastUpdated` to the new date.
- **10.2 Terms of service.** `terms-of-service/page.tsx` says portal access is by email only and omits rescheduling. Update it, its `lastUpdated`, and have counsel review it.
- **10.3 Consent checkbox.** Section 4 of `docs/compliance-patient-data.md` says the label mentions health data, but the labels in `PatientSteps.tsx` and `PortalConsent.tsx` say only "mis datos personales". Change the labels or the document once counsel decides.
- **10.4 Consent revocation procedure.** The product has no revocation flow and nothing writes `PatientConsent.revokedAt` (decided 2026-11-06), but revocation is a right under article 8 of Ley 1581 and the policy offers it. Write the manual procedure for requests through `privacidad@`, then correct section 4 of `docs/compliance-patient-data.md`, which still describes revocation as a feature.
- **10.5 Compliance checklist** (`docs/compliance-patient-data.md`, section 5). Controller identity, NIT and any Colombian representative; RNBD decision; processor contracts, including accepting the Sentry DPA; international transfer basis; `privacidad@` monitoring and the 10/15 business-day runbook; incident procedure; retention table and erasure path.

**Operations (before enabling; owner: account admin).**
- **10.6 Backups and keys.** The four backup checks in `docs/operations.md`, including a restore rehearsal. `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` provisioned and backed up apart from the database.
- **10.7 Production database and headers.** Confirm the `btree_gist` permission. Set `CSP_ENFORCE=true` for the staging Portal build and redeploy, because headers are set at build time. The full e2e suite passed under the enforced policy on 2026-11-06 and CI now runs that way, so the check on staging covers what e2e cannot: the real Turnstile site key, the Google OAuth popup and a Sentry test error. Then set it for production.
- **10.8 WhatsApp and Twilio (was 9.0).** Templates approved and all 12 portal SIDs set: they are required at boot even with `ENABLE_PORTAL=false`, so a deploy without them does not start the API. Send real codes to the main Colombian carriers. Set the Twilio usage alert and Geo Permissions. Run a full login, booking and message check on a real phone.

**Code.**
- **10.9 Remove the transitional `email`.** After the Portal that reads `contact` is deployed, drop `email` from `sessionContactView` (`src/portal/portal-contact.ts`), which feeds the session and verify responses. Update the tests and Bruno in the same PR.
- **10.10 Encryption key rotation (was 8.1 and 0.24; not started).** Today `ENCRYPTION_KEY` cannot be rotated: `decrypt` takes a single key and the `enc:v1:` prefix names the format, not the key, so changing the env var makes every encrypted field unreadable. Build: (1) a keyring (`ENCRYPTION_KEY` + `ENCRYPTION_KEY_PREVIOUS`) and an `enc:v2:<kid>:` format that records the key id, still reading `v1`; new writes always use the current key. (2) A re-encrypt command over every `ENCRYPTED_FIELDS` model (10 models, including the `AuditLog` JSON fields), batched and idempotent like `backfill-pii.ts`. `AuditLog` is immutable through the Prisma guard, so it is rewritten with raw SQL as a documented exception (ciphertext only, never content). (3) A runbook in `docs/operations.md`. `BLIND_INDEX_KEY` can already be rotated: set the new key, bump `PII_VERSION`, deploy, and the backfill on start rehashes every row. Until it finishes, rows not yet rehashed are missed by email/phone/name search, `toHash` reply matching and the email unique index, so rotate at a quiet time. Either key is backed up outside Railway before the deploy. **Timing:** not a pilot gate, but build it before real patient data grows, so a leaked key can be rotated right away. Tests: read `v1` and `v2` under a keyring, re-encrypt is idempotent and keeps `updatedAt`, a value under an unknown `kid` fails loudly.
- **10.11 Past appointments in Mis citas.** Add an "Anteriores" list under the upcoming appointments. Today `GET /appointments` returns only upcoming ones (`listUpcoming`), so this needs a new read scoped through `resolvePortalPatient`, with the same consent gate, and a DTO allow-list. Update the Bruno collection in the same PR. Smallest of the three.
- **10.12 Skip the name for recognized patients.** The form says it will use the saved data but still requires name and surname, because `createPortalBookingSchema` requires `patient`. In auto-confirm, a session that resolves to a consented patient could omit it. Open point: confirm this respects "must not reveal patient existence" before building. Approval mode must keep asking, because that path never looks up a patient. Phone sessions must never display a saved name.
- **10.13 Hold the slot during verification.** In auto-confirm nothing holds the chosen time while the patient requests and enters the code, so it can be lost after all that work. Consider a short anonymous hold. Open points: abuse (holds without a proven contact), interaction with `booking_requests_no_hold_overlap` and `loadLiveHolds`, and expiry. Largest of the three, so weigh it against how often patients actually lose a slot.

**Decisions.**
- **10.14 Who pays** for WhatsApp and SMS? The default is the platform.
- **10.15 Patient-chosen channel.** The patient chooses email or WhatsApp at login, and for a patient the portal creates, that choice becomes `reminderChannel`. An existing patient's messages keep following the provider's setting. Should a patient be able to change that, with a fresh OTP proving the new contact? This would relax "the portal never updates an existing Patient".

**Later, only if real use shows the need.**
- **10.16** A merge action in the inbox for duplicate patients, and a "next available date" hint on the booking page.

**Documentation.**
- **10.17** Record the Google connection finding in `docs/operations.md`, which still says "to do" although 8.2 (a) is marked complete. Correct the config path in AGENTS.md (`src/utils/config.ts` is now `src/utils/config/config.ts`). Decide whether `docs/` stays in `.gitignore`: since `ca3d4385`, new files there, including the `docs/adr/` that AGENTS.md mentions, are silently ignored.

### Dependency summary
`0 → 1 → 2 → 3 → 4 → 5`; Phase 6 depends on 4; Phase 7 depends on 6 (7.3-A gates 7.3-B; 7.4-A/B are independent). Phases 5 and 6 can run in parallel after the MVP. Phase 8 is independent of the portal; 8.2 (b)–(c) must land before 5.4 (5.1–5.3 don't depend on it). Phase 9 depends on 6 and 7. Phone login cannot be separated from the portal, so 9.0 gates enabling the portal in production, including any pilot. 9.0 also gates 9.1 and 9.3 (templates), then `9.1 → 9.2 → 9.3 → 9.4`. Within Phase 0: 0.2 gates 4.1; 0.4 and 0.23 gate 3.3 (matching); 0.5/0.6/0.7 gate Phase 3; 0.11 gates 2.1; 0.14/0.15 gate 2.3; 0.17 gates any public launch; 0.20 gates 3.1; 0.22 gates 4.1; 0.23 also gates any pilot with real patients; 0.19 is independent. Phase 1 only needs 0.12 and 0.13, so it can start while the rest of Phase 0 finishes. In Phase 10, 10.1 to 10.8 gate enabling the portal in production, 10.9 follows the Portal deploy, and the rest are independent.

## Verification
- Integration tests per `AGENTS.md` (real Postgres, mocked Twilio/Brevo/dispatch), including the concurrent-booking race, admin vs portal vs blocked-time races, cross-tenant slug isolation, portal vs provider token rejection, uniform responses regardless of patient existence, and email-normalization collisions.
- `supertest` app-level tests for CORS classes, Origin/CSRF enforcement, cookie attributes, body limits, and the error handler.
- Slot generator unit tests for DST gap/overlap days and buffer/fit rules.
- Playwright e2e for the booking flow in `Portal/e2e` against a self-contained stack.
