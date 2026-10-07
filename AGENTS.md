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
  (`migrations/20261011000000_encrypt_patient_pii`, replaces `patients_userId_email_normalized_active_key`) and exclusion constraint
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
Suite: `45` files, `542` tests, all against real Postgres, `tsc --noEmit` clean.

| Area | File | Covers |
|------|------|--------|
| App layer (supertest) | `test/integration/app/app.integration.test.ts` | real `app`: request id, nosniff header, JSON 404/400/413, CORS allow/reject, rate limit (stays last: limiter is process-wide per IP) |
| Public API classes | `test/integration/app/public-api.integration.test.ts` | anonymous vs credentialed-session CORS classes, exact-Origin on mutations, CSRF binding, 10kb body limit, cookie attributes, CAPTCHA hook, Postgres shared-store rate limit (hashed keys), real-app provider CORS + dark `/v1/public` |
| Appointments (concurrency) | `test/integration/appointments/appointment.concurrency.integration.test.ts` | provider lock + `appointments_no_provider_overlap`: concurrent creates/moves (one winner), cross-patient overlap, back-to-back OK, other provider unaffected, cancelled ignored, reactivation conflict, blocked-time races, DB backstop error shape |
| Appointments (integrity) | `test/integration/appointments/appointment.integrity.integration.test.ts` | status transitions via update, partial time-range validation, create status restriction, reactivation/restore conflict re-checks, audit rows written with the operation, tenant-scoped repository update |
| Appointments (repo) | `test/integration/appointments/appointment.repository.integration.test.ts` | create/read/findById/getStats/restore, ownership scoping |
| Appointments (routes) | `test/integration/appointments/appointment.routes.integration.test.ts` | full HTTP layer: POST/GET/PATCH/confirm/cancel/pay/delete/restore, conflict 409, validation 400/422, ownership 404 (non-virtual location avoids Google) |
| Auth | `test/integration/auth/auth.integration.test.ts` | login, JWT, lockout |
| Users (repo) | `test/integration/users/user.repository.integration.test.ts` | CRUD, scoping |
| Medical records (repo) | `test/integration/medical-records/medical-record.repository.integration.test.ts` | create/read/delete |
| Reminders (repo) | `test/integration/reminders/reminder.repository.integration.test.ts` | create/findById/update/cancel/findMany/getStats/softDelete+restore |
| Reminders (svc) | `test/integration/reminders/reminder.service.integration.test.ts` | cancel/softDelete/restore, sendAt reschedule (pg-boss mocked) |
| Reminders (routes) | `test/integration/reminders/reminder.routes.integration.test.ts` | POST/GET/PATCH/cancel/delete/restore/stats; validation 400, ownership 404 (`getBoss` + jobManager mocked) |
| Locations (repo) | `test/integration/locations/location.repository.integration.test.ts` | CRUD, scoping |
| Appointment types (repo) | `test/integration/appointment-types/appointment-type.repository.integration.test.ts` | CRUD, scoping |
| Consent doc | `test/integration/consent-documents/consent-document.integration.test.ts` | upload/read/byUserId |
| Blocked time (repo) | `test/integration/blocked-time/blocked-time.repository.integration.test.ts` | CRUD, pagination, filtering, overlap detection, softDelete+restore |
| Blocked time (routes) | `test/integration/blocked-time/blocked-time.routes.integration.test.ts` | HTTP layer: CRUD, validation 400, ownership 404, pagination |
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
| Patients (PII encryption) | `test/integration/patients/patient.pii-encryption.integration.test.ts` | ciphertext at rest (patient name/last name/email/phones, reminder to/subject, medical record name/birth place), blind indexes on create/update/clear, whole-word accent-insensitive name search + exact email/phone across patient/appointment/reminder/medical-record lists, tenant isolation, in-memory sort by name/email with pagination, `backfillPii` (encrypts legacy rows, keeps `updatedAt`, idempotent, uniqueness after backfill) |
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
  raw emails or phone numbers (use `maskEmail`/`maskPhone`). The logger redacts PII keys
  (`email`, `to`, `lastName`, `phone`, ... top level and one level deep) as a safety net and
  adds the request id to every line via `AsyncLocalStorage`; do not rely on redaction as the
  primary control.
- Public portal API (`ENABLE_PORTAL=true`): mount only via `createPublicApiRouter()` (anonymous,
  no cookies/credentials) or `createPortalSessionRouter()` (credentialed, exact Origin on
  mutations). Both are mounted in `app.ts` BEFORE the provider CORS/15mb parsers/global limiter.
  Session routes must add `requireCsrf` (except `otp/verify`). Use `createPublicLimiter` (Postgres
  store, hashed keys) for per-IP/per-email/per-provider limits. `trust proxy` is exactly 1 hop.
- `NODE_ENV` fails closed: unset/blank behaves as `production` (`resolveNodeEnv`). Webhook signature
  checks are skipped only when `NODE_ENV=development` is set explicitly. Local dev must set it (see `.env.example`).
- Time math goes through `src/utils/time/time-utils.ts` (luxon). DST conventions: spring-forward
  gap times do not exist (`resolveLocalTime(...).exists === false`; `localToUtc` shifts forward),
  fall-back overlaps use the first occurrence (`ambiguous: true`). Slot generation must skip
  nonexistent times. Never hand-roll offset arithmetic.
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
