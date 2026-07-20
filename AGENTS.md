# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Repository layout
- `Server/` — Nest-free Node/TS backend (Prisma + pg-boss). Contains both unit and integration tests.
- `Portal/` — Next.js frontend (Playwright e2e lives here).

## Running integration tests (Server)
Integration tests hit a **real Postgres** and must run against a disposable test database.
They use the `integration` vitest project (`src/**/*.integration.test.ts`).

1. Start the test database (port 5433):
   ```bash
   cd Server
   docker compose -f docker-compose.test.yml up -d
   ```
2. Run the suite (loads `.env.test` automatically via `test/integration/setup.ts`):
   ```bash
   cd Server
   npm run test:integration
   ```
3. The suite runs serially (`fileParallelism: false`) and truncates all `public`
   tables between tests. `DATABASE_URL` must contain the string `test` or the guard
   refuses to run.

### Common pitfalls
- **Keep `.env.test` in sync with `.github/workflows/ci.yml`.** CI supplies env vars
  directly (it does NOT load `.env.test`). When you add a `requireEnv(...)` var in
  `src/utils/config.ts`, update both places.
- **Never point `DATABASE_URL` at dev/prod** — the guard blocks non-`test` URLs.
- **Stale generated client:** if you change `schema.prisma`, run `npx prisma generate`.
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
Suite: `15` files, `100` tests, all against real Postgres, `tsc --noEmit` clean.

| Area | File | Covers |
|------|------|--------|
| Appointments | `src/appointments/appointment.integration.test.ts` | create/read/findById/getStats/restore, ownership scoping |
| Auth | `src/auth/auth.integration.test.ts` | login, JWT, lockout |
| Users | `src/users/user.integration.test.ts` | CRUD, scoping |
| Medical records | `src/medical-records/medical-record.integration.test.ts` | create/read/delete |
| Reminders (repo) | `src/reminders/reminder.repository.integration.test.ts` | create/findById/update/cancel/findMany/getStats/softDelete+restore |
| Reminders (svc) | `src/reminders/reminder.service.integration.test.ts` | create(=false), cancel/softDelete/restore, sendAt reschedule (pg-boss mocked) |
| Locations | `src/locations/location.integration.test.ts` | CRUD, scoping |
| Appointment types | `src/appointment-types/appointment-type.integration.test.ts` | CRUD, scoping |
| Consent doc | `src/consent/consent-document.integration.test.ts` | upload/read/byUserId |
| Twilio webhook | `src/twilio/twilio-webhook.integration.test.ts` | status callback handling |
| Twilio client | `src/twilio/twilio-client.integration.test.ts` | send wrappers (mocked SDK) |
| Scheduler | `src/scheduler/scheduler.integration.test.ts` | `send-reminder` worker via real pg-boss + dispatch mock |
| Scheduler workers | `src/scheduler/workers.integration.test.ts` | `completeAppointments`, `trackDelivery` (stale/failed/delivered), `dailyReminder` (dispatch mock, `config` hour pin) |
| Notify routes | `src/notify/notify.integration.test.ts` | POST /whatsapp & /sms → create+send+SENT; ownership 404; Twilio-failure → FAILED (jobManager + twilio mocked) |
| Patient seed | `src/patients/patient.integration.test.ts` | seed/ownership baseline |

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
- Unit tests (`src/**/*.test.ts`) mock Prisma/DB and run fast.
- `test/integration/helpers.ts` provides `createTestUser`, `createTestPatient`,
  `createTestLocation`, `createTestAppointmentType`, `appointmentTimeRange`, `futureDate`,
  and `unique` (sequence-suffixed unique strings for emails etc.).

## Playwright e2e handoff (future work — Portal)
The repository-level integration tests validate the DB layer that the future Playwright
e2e suite will exercise end-to-end. When adding e2e tests:
- A running **Server** + **Postgres** (seeded admin via `npm run db:seed-admin`) + **Portal** are required.
- The Server must be started with `ENABLE_SCHEDULER=false` so background pg-boss workers
  don't poll the shared test DB outside the controlled test run.
- Reuse the same `DATABASE_URL` ("test") discipline — never target non-test databases.
- Prefer asserting against the same repository/service behaviors covered here to avoid
  duplication and drift between service and repository layers.
