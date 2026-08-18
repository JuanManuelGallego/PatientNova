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
- **External services are mocked at module boundaries** in tests: `twilio` SDK
  (`vi.mock('twilio')`), `src/twilio/twilioClient.js`, and `src/scheduler/dispatch.js`.
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
Suite: `27` files, `317` tests, all against real Postgres, `tsc --noEmit` clean.

| Area | File | Covers |
|------|------|--------|
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
| Twilio webhook (svc) | `test/integration/twilio/webhook.integration.test.ts` | status callback handling (confirm/cancel/unknown intent) |
| Twilio webhook (route) | `test/integration/twilio/webhook.routes.integration.test.ts` | HMAC auth middleware: valid sig → 200 + process; missing/bad/tampered sig → 403; service mocked |
| Twilio client | `test/integration/twilio/client.integration.test.ts` | send wrappers (mocked SDK) |
| Twilio status callback (route) | `test/integration/twilio/status-callback.routes.integration.test.ts` | `POST /webhooks/twilio/status`: HMAC auth middleware valid sig → 200 + service; missing/bad/tampered sig → 403; service mocked |
| Twilio status callback (svc) | `test/integration/twilio/message-status.service.integration.test.ts` | `processMessageStatusCallback`: delivered→SENT, failed→FAILED+resolved error, queued no-op, ghost sid no-op, out-of-order guard (late FAILED wins, stale SENT ignored), tenant isolation by messageId |
| Notify (routes) | `test/integration/twilio/notify/notify.integration.test.ts` | POST /whatsapp & /sms → create+send+SENT; ownership 404; Twilio-failure → FAILED (jobManager + twilio mocked) |
| Bulk send (routes) | `test/integration/twilio/notify/notify-bulk.integration.test.ts` | POST /notify/bulk: 201 + staggered enqueue, SCHEDULED honors sendAt, template 400/403, SMS body render per patient (`{{N}}` placeholders) + missing-body 400, scheduler-off 503, ownership/number skips, dedupe, enqueue-failure → FAILED, CREATE audits (`getBoss` mocked, test template registered on `BULK_TEMPLATE_CONFIG`) |
| Scheduler | `test/integration/scheduler/scheduler.integration.test.ts` | `send-reminder` worker via real pg-boss + dispatch mock |
| Scheduler workers | `test/integration/scheduler/workers.integration.test.ts` | `completeAppointments`, `trackDelivery` (stale/failed/delivered), `dailyReminder` (dispatch mock, `config` hour pin) |
| Bulk send (worker) | `test/integration/scheduler/bulk-send-worker.integration.test.ts` | `bulkSendWorker`: QUEUED + messageId, not-found/non-PENDING/deleted/future-sendAt skips, invalid → FAILED, non-final retry rethrows, final retry → FAILED without dead-letter (dispatch mock) |
| Patients (repo) | `test/integration/patients/patient.repository.integration.test.ts` | create/read/email normalization/softDelete+restore/ownership/getStats/findByIdWithRelations |
| Patients (routes) | `test/integration/patients/patient.routes.integration.test.ts` | POST/GET/PATCH/delete/restore/stats; validation 400, ownership 404 |
| Audit log (core) | `test/integration/audit-log/audit-log.integration.test.ts` | CRUD, filtering, ordering, pagination, scoping, Prisma immutability guard, routes |
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
