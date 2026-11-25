# PatientNova

PatientNova is a medical practice management platform with a Spanish-language provider dashboard and public online booking. It brings together patients, appointments, clinical records, and notifications through WhatsApp, SMS, and email.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Notification System](#notification-system)
- [Background Workers](#background-workers)
- [Security](#security)
- [Testing](#testing)
- [Operations and Documentation](#operations-and-documentation)

## Overview

The provider dashboard manages patient records, clinical histories, scheduling, payments, booking requests, and message delivery. Each provider has their own data, timezone, availability, and booking settings.

Patients can book through `/book/<slug>` without creating an account. They choose a service, location, and time, enter their name and an email address or WhatsApp number, accept the portal authorization, and receive a confirmation link. Only clicking **Confirmar mi cita** on that page books the appointment or submits it for provider approval.

**Current scope:** booking by confirmation link is implemented. Patient self-service ("Mis citas": listing, cancellation, and rescheduling) remains deferred behind `ENABLE_SELF_SERVE=false`. No patient login or session-issuing flow currently exists; leave this flag off.

## Features

### Patients and Medical Records

- Patient creation, editing, soft deletion, status management, search, pagination, and statistics
- Email, WhatsApp, and SMS contacts, preferred reminder channel, notes, and portal access controls
- Clinical histories with personal and family background, family members, evolution notes, and attached documents
- Medical record PDF export and provider consent document management
- Encrypted patient and clinical fields, with blind indexes for supported searches
- Versioned patient consent records and an activity log for provider, patient-portal, and background actions

### Appointments and Calendar

- Calendar and list views, filters, revenue statistics, payment tracking, and blocked time
- Appointment types with default duration and price; physical and virtual locations
- Provider-wide conflict detection for active appointments, backed by database locking and an exclusion constraint
- Statuses: `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- Provider timezone display and patient timezone handling for booking and messages
- Google Meet integration, connection checks, and a manual link workflow when automatic provisioning is unavailable

### Public Booking and Request Review

- Public provider profiles with specialty, biography, branding, public contact details, and legal identity
- Weekly availability, booking horizon, lead time, buffers, bookable services and locations, and readiness checks
- Confirmation links by email or WhatsApp, with a slot held for up to 15 minutes, capped at the appointment start
- Opening a link only displays its state; confirmation requires an explicit button click
- `AUTO_CONFIRM` books after contact confirmation; `REQUIRE_APPROVAL` sends the request to the provider inbox
- Requests needing patient matching review also enter the inbox; providers can link, reactivate, or restore eligible records when approving
- Confirmed pending requests hold their time for up to 48 hours, capped at the appointment start, with expiry and provider nudges
- Paused booking keeps the provider profile reachable; search indexing is an explicit provider opt-in while booking is open

### Reminders, Notifications, and Settings

- Immediate and scheduled messages through WhatsApp and SMS via Twilio, and email via Brevo
- Bulk messaging, delivery tracking, failure alerts, and a daily provider agenda
- Configurable reminder timing for online bookings, plus booking, approval, cancellation, and meeting-link notices
- Provider profile, avatar/logo, banking information, timezone, and notification preferences
- Roles: `SUPER_ADMIN`, `ADMIN`, `VIEWER`, with super-admin user management and account safeguards
- Responsive provider dashboard, public marketing pages, and a provider PWA shell with an offline fallback

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript 6 |
| UI | Tailwind CSS 4, CSS Modules, Lucide icons, in-house components and date/time pickers |
| Frontend utilities | dayjs, nuqs, React PDF |
| Backend | Node.js 26.x (ESM), Express 5, TypeScript 6, Zod 4 |
| Database | PostgreSQL, Prisma 7 with the pg adapter |
| Jobs and time | pg-boss 12, Luxon |
| Messaging | Twilio SDK 6 (WhatsApp/SMS), Brevo transactional email |
| Video calls | Google OAuth and Google Meet API |
| Security and observability | JWT, bcrypt, Helmet, CORS, rate limiting, Cloudflare Turnstile, Pino, optional Sentry |
| Testing | Vitest, React Testing Library, real-Postgres integration tests, Playwright |

## Architecture

```text
Request → Routes / Validation → Service → Repository → Prisma → PostgreSQL
                                     ↘ pg-boss → Workers → Messaging / Google APIs
```

- **Provider isolation:** authenticated operations scope records to the provider's `userId`; public booking exposes allow-listed provider and slot data.
- **Separate API boundaries:** anonymous public booking and optional patient sessions have their own routers, CORS rules, parsers, and limiters, ahead of provider middleware.
- **Calendar integrity:** appointment, blocked-time, and booking changes use a provider lock and transactions. Slot rules account for availability, active appointments, blocked time, buffers, and live booking holds.
- **Audit and jobs:** transactional audits and queued booking/reminder jobs commit with their domain changes. Workers reread state before sending or provisioning.
- **Data lifecycle:** supported records use soft deletion; consent revocation, permanent erasure, and clinic export have dedicated operator commands.
- **Time handling:** availability uses wall-clock time in the provider's IANA timezone; appointment instants and calendar-only dates have distinct conversion helpers.

## Project Structure

```text
PatientNova/
├── Portal/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (provider)/          # Landing, login, and (protected) dashboard routes
│   │   │   ├── (marketing)/         # Product pages and FAQ
│   │   │   └── book/                # Public profiles, booking, confirmation, deferred Mis citas
│   │   ├── api/                     # Provider, public, and patient-session API hooks
│   │   ├── components/              # Calendar, pickers, drawers, clinical records, public booking
│   │   ├── providers/               # Auth, theme, timezone, and other React providers
│   │   └── config/, hooks/, types/, utils/
│   ├── test/                        # Vitest and React Testing Library
│   ├── e2e/                         # Playwright, fixtures, mock Brevo, screenshot tooling
│   └── public/                      # Static assets, service worker, offline fallback
├── Server/
│   ├── schema.prisma
│   ├── migrations/                  # Prisma and raw-SQL constraints/indexes
│   ├── src/
│   │   ├── auth/, users/            # Provider sessions and account management
│   │   ├── patients/, medical-records/, consent-documents/
│   │   ├── appointments/, appointment-types/, locations/, blocked-time/
│   │   ├── booking-settings/, public-booking/, booking-requests/
│   │   ├── portal/, patient-consents/ # Confirmation flow, patient actions, consent
│   │   ├── reminders/, twilio/, brevo/, google/
│   │   ├── audit-log/, middlewares/
│   │   ├── scheduler/               # pg-boss queues and workers
│   │   └── utils/                   # Config, encryption, Prisma, time, logging, operators
│   ├── test/unit/
│   ├── test/integration/
│   └── docker-compose.test.yml      # Disposable PostgreSQL on localhost:5433
├── ops/db-backup/                   # Encrypted offsite database backup and smoke test
├── docs/                           # Operations, patient-data procedures, versioned legal texts
├── .github/workflows/ci.yml         # Portal, Server, and self-contained e2e jobs
└── Bruno Collection/               # Manual API requests
```

## Getting Started

### Prerequisites

- **Node.js 26.x**, with the exact development/CI version pinned in [`.nvmrc`](.nvmrc)
- **pnpm 12.23.0**, pinned in both app manifests; install with `npm install -g pnpm@12.23.0`
- **PostgreSQL** with permission to create the `btree_gist` extension used by calendar constraints; the test stack uses PostgreSQL 18
- **Docker** for the disposable integration-test database
- **Twilio** credentials, WhatsApp/SMS senders, and approved WhatsApp Content Templates for messaging
- **Brevo** credentials and a verified sender for email
- **Cloudflare Turnstile** keys for public booking; local test keys are shown below
- Optional **Google OAuth** credentials for Meet integration

### Environment Variables

From the repository root, copy the examples and fill in the values before running backend commands:

```bash
cp Server/.env.example Server/.env
cp Portal/.env.example Portal/.env.local
```

Use the examples as a starting point; backend runtime settings are defined in [`Server/src/utils/config/config.ts`](Server/src/utils/config/config.ts). The main backend settings are:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set `development` explicitly locally. An unset/blank value is treated as production. |
| `DATABASE_URL` | Connection string for your development PostgreSQL database |
| `AUTH_SECRET` | Provider JWT/CSRF secret; generate with `openssl rand -hex 64` |
| `PORTAL_AUTH_SECRET` | Required separate patient-session secret, even with self-service off; generate independently from `AUTH_SECRET` |
| `ENCRYPTION_KEY` | 64-character hex AES-256-GCM key; generate with `openssl rand -hex 32`; required in production |
| `BLIND_INDEX_KEY` | Separate 64-character hex key for encrypted-field search/uniqueness; required in production |
| `ENCRYPTION_KEY_PREVIOUS` | Optional previous encryption key during a rotation; follow the operations runbook |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Required Twilio credentials |
| `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM` | Required sender numbers |
| `TWILIO_WEBHOOK_BASE_URL` | Public API base URL used to validate Twilio webhook signatures |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_WEBHOOK_SECRET` | Required email credentials, verified sender, and webhook secret; `BREVO_FROM_NAME` is optional |
| `ALLOWED_ORIGINS` | JSON array of allowed provider origins, including `http://localhost:3000` locally |
| `PORTAL_URL` | Portal origin for booking links, patient-session origin checks, and OAuth completion |
| `CAPTCHA_SECRET` | Required Turnstile secret; local test value: `1x0000000000000000000000000000000AA` |
| `CAPTCHA_EXPECTED_HOSTNAMES` | Optional comma-separated hostname allow-list; defaults to the `PORTAL_URL` hostname |
| `ENABLE_SCHEDULER` | Set `true` to run pg-boss workers and scheduled maintenance |
| `ENABLE_SELF_SERVE` | Leave `false`; patient session routes are deferred and no session login flow exists |
| `PORTAL_WHATSAPP_DAILY_CAP` | Distinct numbers allowed WhatsApp booking links per 24 hours across providers; default 60 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed-only credentials for `db:seed-admin`; choose your own password and remove them from production runtime configuration |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Optional Google OAuth configuration; local callback: `http://localhost:3001/v1/google/oauth/callback` |
| `SENTRY_DSN` | Optional backend error reporting; leave empty to disable |

WhatsApp template SIDs live in [`Server/src/twilio/whatsapp-templates.ts`](Server/src/twilio/whatsapp-templates.ts), rather than environment variables. Google credentials may be omitted for manual video-call links.

Frontend configuration:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API origin without `/v1`, e.g. `http://localhost:3001` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Booking CAPTCHA site key; local test value: `1x00000000000000000000AA` |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional browser error reporting |
| `CSP_ENFORCE` | `true` enforces the content security policy; otherwise it is report-only |

Use the Turnstile test keys only for development/tests. Vercel production builds require `SENTRY_AUTH_TOKEN` for source-map upload; see the operations runbook.

### Installation

Start your development database and configure the environment files, then run these commands from the repository root:

```bash
cd Server
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run db:seed-admin

cd ../Portal
pnpm install --frozen-lockfile
```

The admin seed creates the initial super admin once. Prisma generation is also part of the backend build; it is needed before typechecking or running code that imports the generated client.

### Running the App

Development, in separate terminals from the repository root:

```bash
# Terminal 1 — API at http://localhost:3001
cd Server
pnpm run dev
```

```bash
# Terminal 2 — Portal at http://localhost:3000
cd Portal
pnpm run dev
```

Log in at `http://localhost:3000/login` with the seeded credentials. Configure the provider's public profile, legal identity and contact, availability, and bookable services/locations in booking settings before enabling online booking.

Production builds, with each block starting at the repository root:

```bash
cd Server
pnpm run build
pnpm start
# Runs migrations, PII backfill, and the API; does not seed an admin
```

```bash
cd Portal
pnpm run build
pnpm start
```

For a separate deployment release step, use `pnpm run migrate:deploy` followed by `pnpm run pii:backfill`, then start with `pnpm run start:app`. Deployment, secret management, and backup procedures are in [the operations runbook](docs/operations.md).

## API Reference

Application routes are under `/v1`. Provider routes use JWT authentication and role checks; cookie-authenticated writes require `X-CSRF-Token` from `GET /v1/auth/csrf`. The frontend provider client handles this automatically.

Anonymous booking routes are under `/v1/public` and do not use cookies. The optional `/v1/portal` session routes return 404 with the default `ENABLE_SELF_SERVE=false`.

### Provider API

This is an overview; route modules and the [Bruno collection](Bruno%20Collection/) contain the individual requests and validation details.

| Route | Purpose |
|---|---|
| `/v1/auth` | Login, logout, refresh, CSRF token, password change |
| `/v1/users/me` | Read/update the provider profile |
| `/v1/users` | Super-admin user management |
| `/v1/patients` | Patient CRUD, statistics, and permitted restoration |
| `/v1/appointments` | Appointment CRUD, statistics, pay/confirm/cancel actions, and missing meeting links |
| `/v1/appointment-types`, `/v1/locations` | Service and location configuration |
| `/v1/blocked-time` | Calendar blocks |
| `/v1/medical-records` | Medical record CRUD by record ID, with nested clinical data |
| `/v1/consent-document` | Provider document management, with a separate public download route |
| `/v1/reminders` | Reminder CRUD, statistics, cancellation, and retry |
| `/v1/notify/{whatsapp,sms,email,bulk}` | Immediate and bulk messaging |
| `/v1/booking/settings`, `/v1/booking/availability` | Public profile, booking rules, readiness, and weekly availability |
| `/v1/booking-requests` | Inbox, pending count, detail, approval, and rejection |
| `/v1/audit-logs` | Activity history |
| `/v1/google` | Connection status, verification, OAuth, and Meet creation |

### Anonymous Booking API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/public/providers` | Indexable provider slugs for the sitemap |
| `GET` | `/v1/public/providers/:slug` | Public provider profile and booking state |
| `GET` | `/v1/public/providers/:slug/slots` | Available slots for a service and date range |
| `GET` | `/v1/public/providers/:slug/{avatar,logo}` | Public profile image bytes |
| `POST` | `/v1/public/providers/:slug/bookings` | Start a hold and send the confirmation link; requires booking CAPTCHA; returns 202 |
| `POST` | `/v1/public/booking-confirmations/view` | Read link state without confirming |
| `POST` | `/v1/public/booking-confirmations/confirm` | Confirm the contact and book or submit for approval |
| `POST` | `/v1/public/booking-confirmations/release` | Release a mistaken hold; returns 204 |

Confirmation API calls put tokens in JSON bodies. The patient-facing URL is `/book/confirmar/<token>`; confirmation pages use `noindex` and `no-referrer`.

`GET /health` (also `/v1/health`) checks database connectivity. External webhooks use `POST /webhooks/twilio`, `POST /webhooks/twilio/status`, and `POST /webhooks/brevo`, with vendor authentication.

### Response Format

JSON success responses use `{ success: true, data, timestamp }`. Paginated `data` contains `data`, `total`, `page`, `pageSize`, and `totalPages`. Errors use `{ success: false, error, timestamp }`, with `requestId` when available. Routes returning 204 have no response body.

## Database Schema

The schema is in [`Server/schema.prisma`](Server/schema.prisma), with migrations in [`Server/migrations/`](Server/migrations/).

| Models | Purpose |
|---|---|
| `User` | Provider identity, role/status, timezone, branding, notification preferences, and booking rules |
| `Patient` | Provider-owned patient records, encrypted contacts, blind indexes, source, and access controls |
| `Appointment` | Patient visits, time, price, status, payment, source, and meeting state |
| `AppointmentType`, `AppointmentLocation`, `BlockedTime` | Services, venues, and unavailable calendar time |
| `Reminder` | Channel, destination, content, dispatch time, and delivery state; optional one-to-one appointment link |
| `MedicalRecord`, `FamilyMember`, `SubsystemRelation`, `EvolutionNote`, `MedicalDocument` | Clinical histories and related records |
| `Document` | Provider consent document |
| `AvailabilityRule` | Provider weekly availability windows |
| `BookingRequest` | Unconfirmed holds, confirmed approval/review requests, consent evidence, and hashed tokens |
| `PatientConsent` | Versioned consent and revocation evidence |
| `GoogleConnection`, `GoogleOAuthState` | Encrypted Google refresh tokens and one-time OAuth state |
| `AuditLog` | Provider, public-portal, and job activity |

Raw-SQL migrations maintain partial unique indexes for non-deleted patient emails and current consents, plus exclusion constraints for appointment and booking-hold overlaps. These objects are listed in [`AGENTS.md`](AGENTS.md) and must be preserved when generating migrations.

## Notification System

- **Channels:** Twilio sends WhatsApp/SMS; Brevo sends email. WhatsApp uses approved Content Templates from the code registry.
- **Delivery history:** reminders are persisted before dispatch and track `PENDING`, `QUEUED`, `SENT`, `FAILED`, or `CANCELLED`. Twilio/Brevo callbacks update delivery state; background tracking provides a fallback.
- **Scheduling:** each scheduled reminder has a pg-boss job due at `sendAt`. Appointment changes reconcile the linked reminder; cancelling an appointment cancels its pending reminder.
- **Booking links:** go only to the email or WhatsApp contact selected on the booking form. Failed sends release the hold and return an error. No patient, appointment, or patient-consent record is created before confirmation.
- **Patient routing:** later booking notices use the patient's preferred usable channel, falling back to email, WhatsApp, then SMS. Unverified WhatsApp numbers and patients with messages stopped are excluded.
- **Virtual visits:** automatic Meet provisioning runs in a worker. Patient confirmation waits for the link or the explicit manual-link fallback; providers see appointments needing a link.
- **Timezones:** patient messages use the booking's patient timezone when present; provider notices use the provider timezone.

Booking and request notices use separate queues. With the scheduler disabled, their immediate notices are attempted after commit; scheduled reminders and maintenance require the scheduler.

## Background Workers

Set `ENABLE_SCHEDULER=true` to initialize pg-boss. Queue configuration is in [`Server/src/scheduler/pg-boss.ts`](Server/src/scheduler/pg-boss.ts).

| Queue / Schedule | Purpose |
|---|---|
| `send-reminder` (per reminder) | Send due reminders, retry with backoff, and schedule delivery checks |
| `bulk-send-message` (per message) | Dispatch bulk messages with bounded concurrency and retries |
| `track-delivery` (per-message jobs and hourly sweep) | Poll queued Twilio messages and fail tracking that has timed out; email delivery uses Brevo callbacks |
| `daily-reminder` (hourly) | Send tomorrow's agenda at the configured local provider summary hour |
| `complete-appointments` (every 15 minutes) | Complete scheduled/confirmed appointments whose end time has passed |
| `portal-booking-notify` (per event) | Send appointment and meeting-link notices |
| `booking-request-notify` (per event) | Send request notices, nudges, and unused-link expiry notices |
| `provision-meet` (per appointment) | Create Google Meet links or hand off to manual linking |
| `sweep-pending-meetings` (every 15 minutes) | Move links pending for more than 30 minutes to manual follow-up |
| `sweep-booking-requests` (every 15 minutes) | Expire stale holds and nudge confirmed pending requests |
| `purge-booking-requests` (daily, 03:45 UTC) | Remove old resolved requests and never-confirmed rows according to retention rules |
| `check-google-connections` (daily, 11:00 UTC) | Detect revoked/expired Google refresh tokens |

Reminder and bulk-send queues have dead-letter queues. Shutdown is graceful on `SIGTERM`/`SIGINT`. Hold validity is determined by the clock, so stale holds stop blocking slots even before a sweep runs.

## Security

- Provider JWTs use issuer/audience validation, httpOnly cookies, CSRF protection for cookie writes, bcrypt, and login lockout.
- Super-admin role/status checks reread the actor; account changes invalidate refresh tokens and guard against self-lockout.
- Sensitive patient, clinical, reminder, banking, booking-request, audit, and Google-token fields use AES-256-GCM encryption. Searchable encrypted fields use separate blind indexes.
- Public booking uses Turnstile, per-IP limits, and transactionally enforced contact/provider caps, including WhatsApp spending limits.
- Confirmation/release tokens are random, stored only as hashes, and excluded from API URLs, logs, audit fields, and error reporting.
- Provider/public/session CORS rules are separate. Body limits, Zod validation, Helmet, and a Portal content security policy protect request boundaries.
- Twilio and Brevo webhook authentication is enforced in every environment.
- Logs mask contacts and omit token-bearing paths/queries; optional Sentry events disable automatic data collection and are scrubbed.
- Patient consent is versioned; revocation stops messaging and portal access through the documented operator workflow.

## Testing

Commands below start from the repository root unless stated otherwise.

### Unit Tests and Static Checks

```bash
cd Server
pnpm exec prisma generate
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:coverage

cd ../Portal
pnpm exec tsc --noEmit
pnpm run lint
pnpm test
```

Server unit tests mock Prisma and external services; they still need the required configuration values in `Server/.env`. Both apps provide `pnpm run test:watch`.

### Backend Integration Tests

```bash
cd Server
docker compose -f docker-compose.test.yml up -d --wait
pnpm exec prisma generate
pnpm run test:integration
docker compose -f docker-compose.test.yml down
```

Integration setup loads `Server/.env.test`, applies migrations, runs serially, and truncates application tables between tests. The local database listens on port **5433**. Inherited environment variables take precedence, and `DATABASE_URL` must contain `test`: use only the disposable database. External messaging/CAPTCHA services are mocked.

### End-to-End Tests

Playwright covers authenticated desktop/mobile workflows, the provider PWA, and anonymous booking on desktop/mobile. Use a disposable test/e2e database, seed it with `pnpm run db:seed-e2e` from `Server/`, and run the API, Portal, and mock Brevo server with the environment in the CI e2e job.

Once that stack is running:

```bash
cd Portal
pnpm exec playwright install chromium
pnpm e2e
# Optional interactive runner:
pnpm e2e:ui
```

The environment template is [`Portal/e2e/.env.example`](Portal/e2e/.env.example); full stack settings are in [CI](.github/workflows/ci.yml) and [the e2e runbook](docs/operations.md#end-to-end-tests). Tests run serially against one provider calendar and read booking links from the mock Brevo server. Public booking limits remain active; wait for their 15-minute window before repeating the full public suite.

CI runs Portal lint/typecheck/build/unit tests, Server lint/typecheck/unit/integration tests, and a self-contained Playwright stack with enforced production CSP.

## Operations and Documentation

- [Operations runbook](docs/operations.md): deployment, encrypted backups and restore, key rotation, Sentry/source maps, Google connection recovery, booking templates/caps, and e2e setup
- [Patient-data procedures](docs/compliance-patient-data.md): consent, access restrictions, revocation, erasure, and export
- [Versioned legal texts](docs/legal/versions/README.md) and [clinic data-processing annex](docs/legal/clinic-data-processing-annex.md)
- [Backup tooling](ops/db-backup/): nightly encrypted offsite database backups and an end-to-end smoke test, separate from pg-boss
- [Repository conventions](AGENTS.md): calendar, audit, encryption, API, and test invariants

Backend operator scripts include `consent:revoke`, `patient:erase`, `clinic:export`, `pii:backfill`, `pii:reencrypt`, `pii:key-id`, and `db:verify-restore`. Follow the runbook for their arguments and safeguards.
