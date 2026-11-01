# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Repository layout
- `Server/` — Nest-free Node/TS backend (Prisma + pg-boss). Contains both unit and integration tests.
- `Portal/` — Next.js frontend (Playwright e2e lives here).

## Running integration tests (Server)
Integration tests hit a **real Postgres** and must run against a disposable test database.
They use the `integration` vitest project (`test/integration/**/*.test.ts`).

1. Start the test database (port 5433):
   ```bash
   cd Server
   docker compose -f docker-compose.test.yml up -d
   ```
2. Run the suite (loads `.env.test` automatically via `test/integration/setup.ts`):
   ```bash
   cd Server
   pnpm run test:integration
   ```
3. The suite runs serially (`fileParallelism: false`) and truncates all `public`
   tables between tests. `DATABASE_URL` must contain the string `test` or the guard
   refuses to run.

### Common pitfalls
- **Keep `.env.test` in sync with `.github/workflows/ci.yml`.** CI supplies env vars
  directly (it does NOT load `.env.test`). When you add a `requireEnv(...)` var in
  `src/utils/config.ts`, update both places.
- **Never point `DATABASE_URL` at dev/prod** — the guard blocks non-`test` URLs.
- **Stale generated client:** if you change `schema.prisma`, run `pnpm exec prisma generate`.
  The committed `generated/prisma` client is typechecked, so a stale client surfaces
  as `tsc` errors across many files.
- **Raw-SQL-only database objects** (not expressible in `schema.prisma`) are invisible to
  Prisma's diff, so `prisma migrate dev` may generate a `DROP` for them in the next
  migration (verified on Prisma 7.9.1: `migrate diff` against a migrated DB ignores the
  partial patients index, but re-check when adding expression indexes or `EXCLUDE`). Currently: partial unique index `patients_userId_emailHash_active_key` on
  `(userId, emailHash) WHERE isDeleted = false`
  (`migrations/20261019000000_encrypt_patient_pii`, replaces `patients_userId_email_normalized_active_key`) and exclusion constraint
  `appointments_no_provider_overlap` (`migrations/20261007000000_appointment_no_overlap`, needs
  the `btree_gist` extension). Before committing any generated migration,
  read the SQL and delete any `DROP INDEX`/`DROP CONSTRAINT` for these objects. Add new
  raw-only objects to this list.
- **External services are mocked at module boundaries** in tests: `twilio` SDK
  (`vi.mock('twilio')`), `src/twilio/twilioClient.js`, `src/twilio/email-client.js`
  (Brevo REST API, EMAIL channel; unit tests stub global `fetch`), and `src/scheduler/dispatch.js`.
  Do not add real network calls to integration tests.
- **`reminderJobManager` is mocked** in tests that exercise `reminderService`
  methods depending on pg-boss (`cancel`, `softDelete`, `restore`, `update`
  sendAt reschedule). This avoids the Prisma-`$transaction` / pg-boss connection-pool
  deadlock that aborts `reminderService.create` when a live `boss` shares the
  test DB pool. The `scheduler.integration.test.ts` file is the exception: it calls
  `initializePgBoss()`/`stopPgBoss()` and relies on the real `send-reminder` queue.
- **`asyncHandler` swallows thrown errors** and writes them to `res` via
  `handleError(res, err)` — it does NOT call `next(err)`. Route tests that invoke
  handlers directly must assert on `res.statusCode`/`res.body`, not on a `next` mock.
  Also note `asyncHandler` drops the returned promise, so flush microtasks before
  inspecting `res`.

## Integration coverage matrix (Scope A)
Suite: `48` files, `588` tests, all against real Postgres, `tsc --noEmit` clean.

| Area | File | Covers |
|------|------|--------|
| App layer (supertest) | `test/integration/app/app.integration.test.ts` | real `app`: request id, nosniff header, JSON 404/400/413, scoped body limits (100kb default, large only on file-upload routes), message-status endpoint removed, provider CSRF on cookie-authenticated writes, CORS allow/reject, rate limit + webhooks exempt from it (stay last: limiter is process-wide per IP) |
| Public API classes | `test/integration/app/public-api.integration.test.ts` | anonymous vs credentialed-session CORS classes, exact-Origin on mutations, CSRF binding, 10kb body limit, cookie attributes, CAPTCHA hook (400 on failure, 503 on provider outage), public rate limit (JSON 429, per-key), real-app provider CORS + dark `/v1/public` |
| Public booking (routes) | `test/integration/public-booking/public-booking.routes.integration.test.ts` | `/v1/public/providers/:slug` (+ `/slots`, `/avatar`, `/logo`) on an app wired like `app.ts` with the portal on: identical 404 for unknown/malformed/reserved/disabled/not-ready/inactive/deleted providers, exact allow-listed profile keys (no ids but type/location, no `instructions`), hidden non-bookable/inactive/deleted/virtual types and locations, image allow-list (PNG/JPEG/WebP) + `nosniff` + `Cross-Origin-Resource-Policy: cross-origin`, slots in the provider zone with the type duration (client `duration` ignored), active appointments (buffered) and blocked time excluded but not cancelled/deleted, provider isolation, foreign type 404, range/date 400s, no cookies or credentialed CORS |
| Appointments (concurrency) | `test/integration/appointments/appointment.concurrency.integration.test.ts` | provider lock + `appointments_no_provider_overlap`: concurrent creates/moves (one winner), cross-patient overlap, back-to-back OK, other provider unaffected, cancelled ignored, reactivation conflict, blocked-time races, DB backstop error shape |
| Appointments (integrity) | `test/integration/appointments/appointment.integrity.integration.test.ts` | status transitions via update, partial time-range validation, `cancelledBy` set/cleared, past-appointment lock (plain edits OK, no move/reactivate into the past), create status restriction, reactivation/restore conflict re-checks, audit rows written with the operation, tenant-scoped repository update |
| Appointments (repo) | `test/integration/appointments/appointment.repository.integration.test.ts` | create/read/findById/getStats/restore, ownership scoping |
| Appointments (routes) | `test/integration/appointments/appointment.routes.integration.test.ts` | full HTTP layer: POST/GET/PATCH/confirm/cancel/pay/delete/restore, conflict 409, validation 400/422, ownership 404 (non-virtual location avoids Google) |
| Auth | `test/integration/auth/auth.integration.test.ts` | login, JWT, lockout (atomic counter: concurrent wrong guesses all count) |
| Users (repo) | `test/integration/users/user.repository.integration.test.ts` | CRUD, scoping |
| Medical records (repo) | `test/integration/medical-records/medical-record.repository.integration.test.ts` | create/read/delete |
| Medical records (calendar-day migration) | `test/integration/medical-records/calendar-day-migration.integration.test.ts` | `20261018000000_calendar_day_utc_midnight`: local midnights (west/east of UTC) and save times → UTC midnight of the provider-zone day; UTC-midnight values untouched; idempotent |
| Reminders (repo) | `test/integration/reminders/reminder.repository.integration.test.ts` | create/findById/update/cancel/findMany/getStats/softDelete+restore |
| Reminders (svc) | `test/integration/reminders/reminder.service.integration.test.ts` | cancel/softDelete/restore, sendAt reschedule (pg-boss mocked) |
| Reminders (routes) | `test/integration/reminders/reminder.routes.integration.test.ts` | POST/GET/PATCH/cancel/delete/restore/stats; validation 400, ownership 404 (`getBoss` + jobManager mocked) |
| Locations (repo) | `test/integration/locations/location.repository.integration.test.ts` | CRUD, scoping |
| Appointment types (repo) | `test/integration/appointment-types/appointment-type.repository.integration.test.ts` | CRUD, scoping |
| Consent doc | `test/integration/consent-documents/consent-document.integration.test.ts` | upload/read/byUserId |
| Blocked time (repo) | `test/integration/blocked-time/blocked-time.repository.integration.test.ts` | CRUD, pagination, filtering, overlap detection, softDelete+restore |
| Blocked time (routes) | `test/integration/blocked-time/blocked-time.routes.integration.test.ts` | HTTP layer: CRUD, validation 400, ownership 404, pagination |
| Booking settings (routes) | `test/integration/booking-settings/booking-settings.routes.integration.test.ts` | `GET/PATCH /booking/settings` (defaults, slug normalize/reserved 400/taken 409, lead time reaching the horizon 422 (merged with stored values), enable needs slug + availability + bookable type + in-person location 422, clearing slug disables, deleting the last bookable location leaves it enabled but `live: false`), slug suggestion, `PUT /booking/availability` whole-week replace (overlap 400, empty-while-enabled 422, one audit row, tenant isolation), `bookableOnline` on locations/types (virtual + bookable 400 both ways) |
| Twilio webhook (svc) | `test/integration/twilio/webhook.integration.test.ts` | quick-reply confirm/cancel under the provider lock, stale replies (cancelled/completed/deleted/rebooked slot) leave the appointment untouched, `cancelledBy=PATIENT`, unknown intent |
| Twilio webhook (route) | `test/integration/twilio/webhook.routes.integration.test.ts` | HMAC auth middleware: valid sig → 200 + process; missing/bad/tampered sig → 403; service mocked |
| Twilio client | `test/integration/twilio/client.integration.test.ts` | send wrappers (mocked SDK) |
| Twilio status callback (route) | `test/integration/twilio/status-callback.routes.integration.test.ts` | `POST /webhooks/twilio/status`: HMAC auth middleware valid sig → 200 + service; missing/bad/tampered sig → 403; service mocked |
| Twilio status callback (svc) | `test/integration/twilio/message-status.service.integration.test.ts` | `processMessageStatusCallback`: delivered→SENT, failed→FAILED+resolved error, queued no-op, ghost sid no-op, out-of-order guard (late FAILED wins, stale SENT ignored), tenant isolation by messageId |
| Notify (routes) | `test/integration/twilio/notify/notify.integration.test.ts` | POST /whatsapp, /sms & /email → create+send+QUEUED; email recipient 400; ownership 404; provider failure → FAILED (jobManager + twilio + email-client mocked) |
| Brevo webhook (route) | `test/integration/twilio/brevo-webhook.routes.integration.test.ts` | `POST /webhooks/brevo/events`: shared secret via Bearer or Basic password → 200 + service (single event or batch array); missing/wrong/unsupported scheme → 403; non-object payload 400; service mocked |
| Brevo events (svc) | `test/integration/twilio/brevo-events.service.integration.test.ts` | `processBrevoEvents`: delivered→SENT, hard_bounce/blocked/invalid_email/error→FAILED+reason+EMAIL failure alert, request/deferred/soft_bounce/opened/spam no-op, out-of-order guard, ghost id no-op, batch continues past bad events |
| Bulk send (routes) | `test/integration/twilio/notify/notify-bulk.integration.test.ts` | POST /notify/bulk: channel resolved per patient from `patient.reminderChannel` (mixed batch, legacy `channel` field ignored), 201 + staggered enqueue, SCHEDULED honors sendAt, template 400/403, missing-body 400, SMS body render per patient (`{{N}}` placeholders), EMAIL to `patient.email` with rendered body+subject / no-email skip, scheduler-off 503, ownership/number skips, dedupe, enqueue-failure → FAILED, CREATE audits (`getBoss` mocked, test template registered on `BULK_TEMPLATE_CONFIG`) |
| Scheduler | `test/integration/scheduler/scheduler.integration.test.ts` | `send-reminder` worker via real pg-boss + dispatch mock |
| Scheduler workers | `test/integration/scheduler/workers.integration.test.ts` | `completeAppointments`, `trackDelivery` (stale/failed/delivered, EMAIL not polled), `dailyReminder` (WhatsApp + EMAIL; dispatch mock, `config` hour pin) |
| Bulk send (worker) | `test/integration/scheduler/bulk-send-worker.integration.test.ts` | `bulkSendWorker`: QUEUED + messageId, not-found/non-PENDING/deleted/future-sendAt skips, invalid → FAILED, non-final retry rethrows, final retry → FAILED without dead-letter, EMAIL body+subject dispatch / missing body → FAILED (dispatch mock) |
| Patients (repo) | `test/integration/patients/patient.repository.integration.test.ts` | create/read/email normalization/softDelete+restore/ownership/getStats/findByIdWithRelations |
| Patients (email integrity) | `test/integration/patients/patient.email-integrity.integration.test.ts` | schema trim/lowercase, normalized unique index (case/whitespace, raw writes), `findByEmail`, cross-provider reuse, soft-delete + restore 409, update conflict 409 without echoing the email |
| Patients (PII encryption) | `test/integration/patients/patient.pii-encryption.integration.test.ts` | ciphertext at rest (patient name/last name/email/phones, reminder to/subject, medical record name/birth place), blind indexes on create/update/clear, 3+ letter prefix accent-insensitive name search, `PII_VERSION` rehash + exact email/phone across patient/appointment/reminder/medical-record lists, tenant isolation, in-memory sort by name/email with pagination, `backfillPii` (encrypts legacy rows, keeps `updatedAt`, idempotent, uniqueness after backfill) |
| Patients (routes) | `test/integration/patients/patient.routes.integration.test.ts` | POST/GET/PATCH/delete/restore/stats; `reminderChannel` default WHATSAPP / set / update / invalid 400; validation 400, ownership 404 |
| Audit log (core) | `test/integration/audit-log/audit-log.integration.test.ts` | CRUD, filtering, ordering, pagination, scoping, Prisma immutability guard, routes |
| Audit log (required) | `test/integration/audit-log/audit-required.integration.test.ts` | `required` audit mode rolls back the change (patient create/update/delete), best-effort default stays non-fatal, PUBLIC_PORTAL actor + new entity types |
| Audit log (writing) | `test/integration/audit-log/audit-log-writing.integration.test.ts` | audit trails for patients/locations/appointment types/blocked time/medical records, actor metadata |
| Audit log (writing expanded) | `test/integration/audit-log/audit-log-writing-expanded.integration.test.ts` | audit trails for appointments/reminders/users/auth/consent docs/twilio webhooks |
| Tenant isolation | `test/integration/tenants/tenant-isolation.integration.test.ts` | cross-tenant data isolation across all repositories |

### Known product bugs found & fixed during test build
- `sendSmsSchema` (`src/utils/validation.ts`) lacked `patientId`, so SMS
  reminders could not be linked to a patient (route threw `PatientNotFoundError`).
  Fixed by adding `patientId: z.uuid().optional()` to mirror the WhatsApp schema.

### Remaining gaps (future phases)
- **Google virtual-location / Meet appointment path** is unexercised. Needs
  `src/google/google-meet.service.js` mocked + a virtual `appointmentLocation`.
- **Playwright e2e (Portal)** — see handoff below.

## Test conventions
- Scope A (implemented): repository/service-level tests against real Postgres, no HTTP layer.
- Unit tests (`test/unit/**/*.test.ts`) mock Prisma/DB and run fast.
- `test/integration/helpers.ts` provides `createTestUser`, `createTestPatient`,
  `createTestLocation`, `createTestAppointmentType`, `appointmentTimeRange`, `futureDate`,
  `unique` (sequence-suffixed unique strings for emails etc.), and the route-layer
  doubles `makeRes`/`invokeRoute(router, method, path, req)` used by the `*.routes.*`
  integration tests. `invokeRoute` chains the full Express middleware stack
  (validateBody/Query/Params + asyncHandler), replicating short-circuiting
  (e.g. a 400 from `validateBody` stops the chain) and polling until `asyncHandler`
  settles the response.

### Calendar integrity rules
- Any transaction that creates/moves an appointment or blocked time must call
  `withProviderLock(tx, userId)` (`src/utils/prisma/provider-lock.ts`) FIRST, then validate and
  write on `tx`. Use `createWithin(tx, dto, userId)` to compose booking steps atomically.
- A provider has one calendar: conflicts are checked per provider (not per patient) over
  SCHEDULED/CONFIRMED, non-deleted appointments, using half-open intervals.
- The exclusion constraint is only a backstop; its violation maps to a neutral 409
  (`isAppointmentOverlapViolation` in `src/utils/errors/prisma-errors.ts`).
- Audit writes that are part of a transaction must pass `tx` AND `required: true`
  (`logAudit`): a swallowed audit failure would leave the Postgres transaction aborted and
  surface later as a confusing commit error. Best-effort (default) is only for
  non-transactional legacy paths. Portal actions run inside
  `runInAuditContext(portalPatientAuditContext({...}), fn)` so rows carry
  `ActionSource.PUBLIC_PORTAL` and a hashed actor id.
- All JWTs go through `src/auth/tokens.ts` (pinned HS256, issuer, per-kind audience; the
  portal session uses its own `PORTAL_AUTH_SECRET`). Never call `jwt.sign/verify` directly.
  Deploying the audience change invalidates existing provider sessions (forced re-login).
- Logging: never log `req.originalUrl` (use `loggedPath(req)`; query strings can carry PII),
  raw emails or phone numbers (log `maskEmail`/`maskPhone` output under `maskedEmail`/`maskedTo`;
  `email`/`to` keys are redacted outright). The logger redacts PII keys
  (`email`, `to`, `lastName`, `phone`, ... top level and one level deep) as a safety net and
  adds the request id to every line via `AsyncLocalStorage`; do not rely on redaction as the
  primary control. Error messages (`new Error(...)`) reach Sentry and must not interpolate names,
  notes, emails or phone numbers: `scrubText` only masks well-formed emails and phone-like numbers.
- Public portal API (`ENABLE_PORTAL=true`): mount only via `createPublicApiRouter()` (anonymous,
  no cookies/credentials) or `createPortalSessionRouter()` (credentialed, exact Origin on
  mutations). Both are mounted in `app.ts` BEFORE the provider CORS/body parsers/global limiter.
  Session routes must add `requireCsrf` (except `otp/verify`). `createPublicLimiter` is a coarse
  in-memory per-IP throttle (resets on restart, per instance), mounted before the router's body
  parser. Brute-force-sensitive limits (OTP verify attempts, resend cooldown, per-email sends) must
  be enforced on the domain record in the same transaction (see `src/utils/security/one-time-code.ts`),
  never by an HTTP limiter. `trust proxy` is exactly 1 hop.
- CAPTCHA (Cloudflare Turnstile): public endpoints that send messages or create records
  (OTP request/resend, anonymous booking) use `requireCaptcha(createCaptchaVerifier(), '<action>')`
  after the limiter and body parser; the Portal renders `<TurnstileWidget action="<action>">` with the
  same action and sends `captchaToken` in the body. Not on `otp/verify` (attempt counter) or session
  routes. The verifier checks hostname, action and `challenge_ts`, and fails closed (provider outage →
  503). Turnstile is used in every environment, with no bypass: `CAPTCHA_SECRET` is always required
  (`.env.test`/CI use Cloudflare's always-pass test secret). Unit tests stub global `fetch`; never call
  siteverify from tests. The Portal CSP always allows `https://challenges.cloudflare.com`, and a build
  without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` shows the widget error instead of submitting.
- Request bodies: the global JSON/urlencoded limit is `100kb`. Routes that accept base64 files
  get a route-scoped parser in `app.ts` (`/v1/users` 2mb, `/v1/consent-document` and
  `/v1/medical-records` 15mb, `/webhooks/brevo` 1mb) mounted BEFORE the default one (the first
  parser to run wins). Rate limiters run before body parsing. The global per-IP limiter skips `/webhooks/*`
  (signature-authenticated, few sender IPs).
- Provider CSRF: access/refresh tokens carry a login-session `sid`; `authenticate` requires
  `X-CSRF-Token` = `createCsrfToken(sid, AUTH_SECRET)` on every method except GET/HEAD/OPTIONS when the token
  came from the cookie (Bearer requests are exempt). The Portal gets it from `GET /v1/auth/csrf`
  and `fetchWithAuth` attaches it (memory only). Route tests: `authReq` already sends a valid
  header via `csrfHeaders()`; keep it when overriding `headers`
  (`{ headers: { ...csrfHeaders(), origin } }`).
- Webhook signature checks (Twilio, Brevo) are always enforced; there is no environment bypass.
  Test webhooks locally with real signatures (e.g. an ngrok tunnel) or by mocking the middleware in tests.
- `NODE_ENV` fails closed: unset/blank behaves as `production` (`resolveNodeEnv`), which requires
  `ENCRYPTION_KEY`. Local dev must set `NODE_ENV=development` explicitly (see `.env.example`).
- Time math goes through `src/utils/time/time-utils.ts` (luxon). DST conventions: spring-forward
  gap times do not exist (`resolveLocalTime(...).exists === false`; `localToUtc` shifts forward),
  fall-back overlaps use the first occurrence (`ambiguous: true`). The slot engine resolves each
  window's edges per date with `localToUtc` and steps in real minutes; a DST jump inside an open
  window is deliberately not special-cased (see the slot contract). Never hand-roll offset arithmetic.
- Portal (provider side) shows every date/time in the provider's timezone (`user.timezone`), never the
  browser's. `AuthContext` calls `setDisplayTimezone` (an invalid zone falls back to the browser's and is
  reported to Sentry). React components read it with `useDisplayTimezone()` (`src/hooks`) and pass it
  explicitly to the `src/utils/TimeUtils.ts` helpers (`fmt*`, `todayFormattedString`, `zonedDateTimeParts`,
  `localDateTimeToUtc`, ...), so a timezone change re-renders in place (no remount). The helpers' implicit
  default is only for non-React callers. Do not use `Date` getters/setters (`getHours`, `setDate`, ...) or bare
  `toLocale*String` on instants. Pickers use `ZonedDatePicker`, which holds the provider's wall-clock time as a
  UTC-mode dayjs (no DST gaps on the device), converted at the edges with `toPickerValue`/`fromPickerValue`.
  The calendar takes one `timezone` from its page and passes it to its hooks and views.
- Online-booking setup (`src/booking-settings/`, mounted at `/v1/booking` behind `requirePortalEnabled`, 404 when
  `ENABLE_PORTAL` is off; `GET /users/me` returns `portalEnabled`). `AvailabilityRule` stores ISO weekday (1=Mon) and
  `startMinute`/`endMinute` as wall-clock minutes in `User.timezone` (half-open, 5-minute grid, no midnight crossing);
  resolve them per date with `resolveLocalTime`, never as fixed UTC offsets. The week is replaced atomically under
  `withProviderLock`. Until 5.4 a location cannot be both `isVirtual` and `bookableOnline`. Readiness (slug,
  availability, bookable type, in-person bookable location) is enforced only when enabling; later edits (deleting the
  last bookable type/location) leave `bookingEnabled` on, and `GET /booking/settings` reports `live: false`. Public
  slot and booking endpoints must gate on `bookingSettingsService.isBookingLive(userId, tx)` (portal on, provider
  active and not deleted, enabled, ready) inside the booking transaction after `withProviderLock`, and answer as for
  an unknown slug when it is false. Never re-derive that check elsewhere.
- Public booking (`src/public-booking/`, mounted at `/v1/public/providers` inside `createPublicApiRouter()`): turn a slug
  into a provider only with `publicBookingService.resolveProvider` (malformed, unknown and not-live slugs all throw the
  same `ProviderNotFoundError`). Public availability goes through `generateSlots`/`isSlotAvailable` only; busy time is
  `ACTIVE_STATUSES` appointments (`src/appointments/appointment-status.ts`) plus non-deleted blocked time. Public DTOs
  are allow-lists: never return `userId`, contact details, settings or location `instructions`. Images are served as
  bytes from data URLs of an allowed type only, with `Cross-Origin-Resource-Policy: cross-origin` (helmet defaults to
  `same-origin`, which blocks the Portal's `<img>`); the Portal CSP `img-src` allows the API origin.
- Calendar days (birth dates, evolution-note dates) are not instants: they are stored as UTC midnight
  (`calendarDayToIso`, `DateTimePicker mode="calendarDay"`) and read by their UTC date (`calendarDayOf`,
  `fmtCalendarDay`, `getAge`), never through a timezone. A bare `YYYY-MM-DD` (list filters,
  `mode="localDate"`) is also a calendar day. Migration `20261018000000_calendar_day_utc_midnight`
  converted legacy rows using the provider's timezone. The patient portal will need its own rule.
- Patient PII is encrypted at rest (`ENCRYPTED_FIELDS`): `Patient.name/lastName/email/whatsappNumber/smsNumber`,
  `Reminder.to/subject`, `MedicalRecord.name/birthPlace`. Never filter, sort or `contains` on these columns
  in SQL (it silently matches nothing). Search with `patientSearchWhere`/`medicalRecordNameWhere`
  (`src/utils/encryption/pii-search.ts`), look up with the blind-index columns (`emailHash`, `toHash`,
  ...; `src/utils/encryption/blind-index.ts`). The Prisma extension writes those columns from the
  plaintext (`BLIND_INDEXES`); never set them by hand. Raw SQL bypasses encryption: do not write these
  columns with `$executeRaw` outside `backfill-pii.ts`. Adding a new PII field: register it in
  `ENCRYPTED_FIELDS` (+ `BLIND_INDEXES` if searched), widen the column to `TEXT`, and add it to the tests.
- Error tracking (Sentry) is opt-in via DSN and must stay PII-free: keep `dataCollection` locked down
  and route events through `scrubEvent`/`scrubBrowserEvent`. Operational notes live in `docs/operations.md`.
