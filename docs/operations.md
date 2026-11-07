# Operations runbook

Everything here is about running PatientNova safely in production. Keep it short and true: if a
step is not actually in place, say so (the privacy policy must never promise more than this file).

## Deploying the API

`pnpm start` runs `prisma migrate deploy`, the PII backfill (`pii:backfill`), seeds the admin and
starts the server. That is fine for a
single instance, but a failing migration then crash-loops the service. Preferred setup:

1. Release step (runs once per deploy, before new instances start):
   `pnpm run migrate:deploy && pnpm run pii:backfill`
2. Start command: `pnpm run start:app` (just `node dist/server.js`)

Migrations that rely on data assumptions (exclusion constraint on appointments, normalized-email
unique index) fail loudly if the assumption is false. Before deploying those, run them against a
restored copy of production.

Raw-SQL-only database objects (not visible to Prisma) are listed in `AGENTS.md`.
`CREATE EXTENSION btree_gist` needs a role allowed to create extensions (typically the database
owner on managed Postgres); verify on the production database before the first deploy.

### Patient PII encryption (first deploy of `20261019000000_encrypt_patient_pii`)
Design and guarantees: `docs/compliance-patient-data.md` section 3.

1. Generate `BLIND_INDEX_KEY` (`openssl rand -hex 32`), different from `ENCRYPTION_KEY`. Store both in
   the secret manager and back them up **separately** from the database backups. Losing
   `ENCRYPTION_KEY` makes patient names and contacts unreadable; losing `BLIND_INDEX_KEY` breaks
   search and email uniqueness until every row is rehashed. The API refuses to start in production
   without them.
2. Take a `pg_dump` (below). After the backfill, older code cannot read the data: rolling back means
   restoring this dump, so prefer rolling forward.
3. Deploy. `pii:backfill` prints `scanned / updated / skipped` per model; on later deploys it scans 0.
   Until it finishes, rows it has not reached are not found by search or by email.
4. Verify: `SELECT count(*) FROM patients WHERE "piiVersion" IS NULL;` must return 0.

### Forced re-login
Token audience/issuer enforcement (`src/auth/tokens.ts`) invalidates every existing provider
session on first deploy. Announce it and deploy outside clinic hours.

## Backups and restore (PostgreSQL)

Status: **nightly offsite backups since 2026-11-06, with a restore rehearsed the same day.** Railway's
own backups are unconfirmed, so user-facing text may claim only the encrypted offsite copies.

- [x] Nightly offsite backup running (`ops/db-backup`), retention 30 days
- [ ] A missed or failed run alerts through Sentry, confirmed once by stopping the job
- [ ] Railway volume backups and point-in-time recovery enabled, if the plan offers them
- [x] Offsite backups encrypted (`age`)
- [ ] Railway's own backups, if enabled: confirm they are encrypted
- [x] A restore was rehearsed in the last 90 days (date: 2026-11-06)

Railway's backups stay inside Railway and wiping a volume deletes them, so the offsite copy is
required either way. Railway's backups only add faster restores.

### Nightly offsite backup

`ops/db-backup` is a Railway cron service: `pg_dump`, encrypted with `age`, uploaded to Cloudflare R2.
It reaches disk only as ciphertext and holds only the public key, so neither Railway's service nor R2
can read a backup. `bash ops/db-backup/smoke-test.sh` runs it end to end, restore included, in
throwaway containers.

1. **R2.** Create a private bucket `patientnova-db-backups`. Add a lifecycle rule that deletes objects
   after 30 days. Create an API token with Object Read & Write on that bucket only.
2. **Encryption key.** Run `age-keygen -o patientnova-backup.key` on your own machine. Store the file
   with the other key backups, then delete the local copy. It prints the public key (`age1...`).
   Losing this key makes every backup useless, and it is the one key that must stay out of Railway.
3. **Sentry.** In `patientnova-server`, create a cron monitor `db-backup` with schedule `0 7 * * *` in
   UTC and an alert on it. Copy its check-in URL, up to the final `/`.
4. **Railway.** Create a service from this repo with Root Directory `ops/db-backup`, Cron Schedule
   `0 7 * * *` (2:00 in Bogotá) and restart policy Never. Set these variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Reference to the Postgres service's URL |
   | `BACKUP_AGE_RECIPIENT` | The `age1...` public key |
   | `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
   | `R2_BUCKET` | `patientnova-db-backups` |
   | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | The token from step 1 |
   | `BACKUP_HEARTBEAT_URL` | The URL from step 3 |

5. **Check.** Run it once with `railway cron run`. A `patientnova-*.dump.age` object appears in the
   bucket and the monitor turns green. Then do the first restore rehearsal below.

The job fails rather than upload when `pg_dump` fails or the file is under `BACKUP_MIN_BYTES` (1024).
Its Postgres client must be at least the server's major version: update `ops/db-backup/Dockerfile`
when the database moves to a newer major version.

### Manual backup

Before risky migrations, and until the nightly job runs:

```bash
pg_dump --format=custom --no-owner --dbname "$DATABASE_URL" \
  | age --recipient age1... --output patientnova-$(date +%F).dump.age
```

### Restore rehearsal

Every 90 days, in Git Bash, so the data stays in memory and the private key stays out of Railway. A
restored database is readable patient data: use this memory-only container, never a Docker volume.
If the image is missing, build it with `docker build --tag patientnova-db-backup:smoke ops/db-backup`.
Download the newest `.dump.age` from R2 into an empty folder outside OneDrive and run these from there.

Start the database, then paste the private key when `read` waits:

```bash
MSYS_NO_PATHCONV=1 docker run -d --rm --name pn-restore --tmpfs /var/lib/postgresql -p 127.0.0.1:5544:5432 -e POSTGRES_PASSWORD=restore -e POSTGRES_DB=restore postgres:18-alpine
read -rs AGE_KEY; export AGE_KEY
```

Restore. `exit 0` means it worked:

```bash
MSYS_NO_PATHCONV=1 docker run --rm -i -e AGE_KEY --network container:pn-restore --entrypoint bash patientnova-db-backup:smoke -c 'set -o pipefail; printf "%s
" "$AGE_KEY" > /tmp/key.txt && age --decrypt --identity /tmp/key.txt | pg_restore --no-owner --no-privileges --dbname postgresql://postgres:restore@127.0.0.1:5432/restore' < patientnova-YYYY-MM-DDTHHMMSSZ.dump.age; echo "exit $?"
```

Compare with the same query on production. Small differences are normal:

```bash
docker exec pn-restore psql -U postgres -d restore -tAc 'SELECT (SELECT count(*) FROM patients), (SELECT count(*) FROM appointments), (SELECT count(*) FROM "AuditLog")'
```

Read rows with the **password manager copies** of the keys, which proves the key backups work. It
exits 0 only when it read rows and decrypted all of them, and prints counts, never patient data:

```bash
read -rs ENCRYPTION_KEY; read -rs BLIND_INDEX_KEY; cd Server
DATABASE_URL="postgresql://postgres:restore@127.0.0.1:5544/restore" ENCRYPTION_KEY="$ENCRYPTION_KEY" BLIND_INDEX_KEY="$BLIND_INDEX_KEY" pnpm run db:verify-restore; echo "exit $?"
```

Clean up: `docker rm -f pn-restore`, delete the downloaded file, close the terminal, and record the
date in the checklist above.

Patient data is sensitive personal data under Ley 1581 de 2012: store dumps only encrypted and
restrict access.

## Error tracking (Sentry, optional)

- Sentry org `juanmanuelgallego`, projects `patientnova-server` and `patientnova-portal`.
- API (Railway): set `SENTRY_DSN`. Every `logger.error`/`logger.fatal` line is
  reported (HTTP 5xx, pg-boss workers, cron, startup), plus uncaught exceptions; startup failures are
  flushed before `process.exit`. Unhandled rejections still crash the process (strict mode), as they
  do without a DSN. Release defaults to `patientnova-server@$RAILWAY_GIT_COMMIT_SHA` and environment to
  `$RAILWAY_ENVIRONMENT_NAME` (override with `SENTRY_RELEASE`/`SENTRY_ENVIRONMENT`). Stack traces are
  readable without an upload: `start` runs `node --enable-source-maps` against tsup's maps.
- Portal (Vercel): set `NEXT_PUBLIC_SENTRY_DSN` at build time. Environment defaults to
  `NEXT_PUBLIC_VERCEL_ENV` (`production`/`preview`; override with `NEXT_PUBLIC_SENTRY_ENVIRONMENT`) and
  release to `patientnova-portal@$NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` (needs Vercel's "Automatically expose
  System Environment Variables", on by default). The CSP `connect-src` is extended automatically.
- Portal source maps: Turbopack writes Debug IDs into the chunks (`turbopack.debugIds`), and
  `compiler.runAfterProductionCompile` calls `scripts/sentry-sourcemaps.mjs` inside `next build` (before
  Vercel collects the output) to upload `.next/static` maps with `SENTRY_AUTH_TOKEN` (an organization
  auth token, set in Vercel for every environment that should upload) and then delete every `.map` so
  none are served. A Vercel production build without the token fails; elsewhere the upload is skipped
  with a warning. Never rewrite chunks after compilation (`sentry-cli sourcemaps inject`): their content
  hash names stay the same and Vercel's CDN keeps serving the previously cached copy.
- Both sides disable every automatic data collector and scrub events (`scrub.ts`): no request bodies,
  cookies, headers, query strings, breadcrumbs or user details; emails/phone numbers in messages are
  masked, and Prisma invocation errors are cut to the operation name (they render argument values). Do not add integrations that re-enable request capture.
- Sentry is a third-party processor: list it in the privacy policy before enabling it in production.

## Google Meet connection

Each provider connects their own Google account (`google_connections`, refresh token encrypted at
rest). A refresh token can stop working without any action in PatientNova.

- **Why connections expire (checked 2026-11-02; the result was not recorded).** In Google Cloud Console →
  OAuth consent screen, check the publishing status. In "Testing", Google expires refresh tokens after
  7 days: move the app to "In production" (verification may be required for the Meet scope). Other
  causes: the provider changed their Google password, revoked access in their Google account, or more
  than 50 refresh tokens were issued for the same account and client.
- **Detection.** With `ENABLE_SCHEDULER=true`, the `check-google-connections` job runs daily at 11:00
  UTC (06:00 Bogotá). It refreshes each active connection's access token. A rejected token
  (`invalid_grant`) marks the connection expired, with one `GOOGLE_CONNECTION` audit row (source
  `JOB`). Network errors or a Google outage change nothing. Providers can also check on demand from
  Settings → Integraciones ("Verificar ahora", `POST /v1/google/connection/verify`, 5 per minute).
- **Recovery.** The provider reconnects from the banner or from Settings. Nothing else is needed.

### Video-call links for online bookings

- A patient booking at a virtual location gets a Meet link from the `provision-meet` job when the
  scheduler runs and the provider's Google connection is usable (the appointment is `PENDING` and the
  patient confirmation waits for the link). Otherwise, or when Google refuses (no connection, revoked
  token, missing scope or configuration) or still fails after 5 attempts, the appointment becomes
  `NEEDS_LINK`: the patient is told the link will follow, and the provider sees it in the banner
  ("citas en línea necesitan un enlace") and in the appointment drawer.
- `sweep-pending-meetings` runs every 15 minutes and hands any link still `PENDING` after 30 minutes to the
  provider, so a stuck job never leaves a patient without a confirmation.
- Recovery: the provider adds any video-call link (Meet, Zoom, ...) by editing the appointment. The
  patient gets it on their channel and the linked reminder is re-rendered. To find affected appointments:
  `GET /v1/appointments/needs-meeting-link` (admins).

## Patient messages and login by WhatsApp

Portal notices and reminders follow each patient's `reminderChannel`, falling back to email, WhatsApp
and SMS. A patient on WhatsApp who logs in with email gets WhatsApp. Phone login is separate and
always on while the portal is.

### Templates

All are required at start: the API does not boot without them. In Spanish, `utility` except the code.

| Env var | Used for | Variables |
|---|---|---|
| `TWILIO_WHATSAPP_PATIENT_PORTAL_OTP_SID` | Login code (`whatsapp/authentication`, 10 min) | code |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_CONFIRMATION_SID` | Booked, approved, meeting ready | provider, date, time, place |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_CANCEL_SID` | Cancelled | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_RESCHEDULE_SID` | Rescheduled | provider, previous date and time, new date, new time, place |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_REQUEST_RECEIVED_SID` | Request receipt | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_REQUEST_REJECTED_SID` | Request rejected | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_PORTAL_REQUEST_EXPIRED_SID` | Request expired | provider, date, time |
| `TWILIO_WHATSAPP_PATIENT_APPOINTMENT_MEETING_LINK_SID` | Meeting link (existing template) | provider, link |

A formatted time ends in "a. m."/"p. m.", so a template must not put a full stop right after a time
variable. The place is the location and address, the meeting link, or "Te enviaremos el enlace pronto".

### Before phone login reaches production

1. Send real WhatsApp codes to the main Colombian carriers. Check delivery, delay and how the
   sender appears.
2. In the Twilio Console: a usage alert, and Geo Permissions on for every country that receives SMS
   reminders. SMS no longer carries login codes.
3. Counsel confirms the privacy policy covers login codes over WhatsApp, and names Meta. Any
   text change bumps `PRIVACY_POLICY_VERSION`, so every patient accepts again once.
4. Check a full login, booking and message on a real phone.

Phone login has no off switch: the login always offers email and WhatsApp. Dropping a channel is a
code change in `portalLoginChannels`.

### Limits

| Limit | Value | Change it with |
|---|---|---|
| Numbers per day, all providers | 300 | `PORTAL_OTP_PAID_DAILY_CAP` |
| Numbers per provider per hour | 30 | `PORTAL_OTP_LIMITS.perProviderPaidPerHour` (code) |
| Sends per number per hour | 3 | `PORTAL_OTP_LIMITS.perPhonePerHour` (code) |

Every code on a phone channel costs money and can be requested anonymously. A hit limit still answers
the usual 202, so the patient sees no difference, and Sentry records `Portal OTP paid cap reached:
<phone-cap | provider-paid-cap | paid-daily-cap>`. One `phone-cap` is usually a patient retrying. Many
`paid-daily-cap` or `provider-paid-cap` events mean number-rotating pumping or a limit set too low:
check Twilio usage before raising anything. Both shared caps count numbers, not messages, because that
is what rotating numbers inflates: each number can still receive 3 codes an hour, so the most that can
be sent is about three times the cap. They can also overshoot slightly under concurrency.
A non-numeric `PORTAL_OTP_PAID_DAILY_CAP` stops the API at boot, so the cap can never silently vanish.

A number without WhatsApp fails after Twilio accepts the message (63024). Neither the code nor a notice
learns about it: at login the patient recovers with email, and later the appointment still shows in
"Mis citas".

## CSP rollout (Portal)

The Content-Security-Policy ships as `Content-Security-Policy-Report-Only`. After a staging soak with
no console violations, set `CSP_ENFORCE=true` for the Portal build to enforce it. Headers are set at
build time, so redeploy after changing the variable.

The policy has no `report-uri`: in report-only mode a violation shows only in the console of whoever
triggers it. The CI e2e job builds with `NODE_ENV=production` and `CSP_ENFORCE=true`, so the suite runs
under the enforced policy. `'wasm-unsafe-eval'` is there for the medical record PDF.

## End-to-end tests

CI runs Playwright against a throwaway stack (Postgres + API + Portal inside the job, seeded by
`pnpm run db:seed-e2e`). Locally: start a database whose name contains `test` or `e2e`, run the API and
the Portal, then `pnpm e2e` in `Portal/` with the variables from the `e2e` job in `.github/workflows/ci.yml`.
The suite runs serially because one provider has one calendar and overlapping appointments are rejected.
