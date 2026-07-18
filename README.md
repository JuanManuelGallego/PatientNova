# PatientNova

A full-stack medical practice management platform for healthcare providers to manage patients, appointments, medical records, and automated notifications via WhatsApp, SMS, and email.

---

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

---

## Overview

PatientNova is a private admin dashboard built for a medical practice. It centralizes patient records, medical histories, appointment scheduling, and outbound notification delivery — sending appointment reminders to patients through **WhatsApp**, **SMS**, or **Email** via Twilio.

The system supports both **immediate dispatch** (send now) and **scheduled delivery** (pg-boss background worker). All notification history is persisted for audit and tracking.

---

## Features

### Patients
- Create, update, and delete patient records
- Track contact info: WhatsApp number, SMS number, email, date of birth, notes
- Patient statuses: `ACTIVE`, `INACTIVE`
- Searchable and filterable list with pagination and status stats

### Medical Records
- Full clinical history per patient: consultation reason, development, lifestyle, trauma, mental history
- Family member tracking with relationships (Father, Mother, Sibling, Spouse, etc.)
- Evolution notes with timestamped entries
- Atomic updates via database transactions

### Appointments
- Schedule appointments with start/end time, type, price, and location
- **Conflict detection** — prevents double-booking patients in overlapping time slots
- Configurable appointment types with predefined durations and pricing
- Configurable locations with color-coded badges
- Statuses: `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- Mark appointments as paid with a single action
- Calendar view (monthly) and list view with filtering
- Revenue stats and status breakdowns
- Google Meet link generation for virtual appointments

### Reminders & Notifications
- Create reminders linked to patients and/or appointments
- Channels: `WHATSAPP`, `SMS`, `EMAIL`
- Modes: `IMMEDIATE` (instant dispatch) or `SCHEDULED` (queued for later)
- Uses Twilio **Content Templates** for WhatsApp (pre-approved message templates with variable substitution)
- Full delivery history with statuses: `PENDING`, `SENT`, `FAILED`, `CANCELLED`, `QUEUED`
- Bulk send wizard for sending reminders to multiple patients at once
- Stats by channel and status, auto-refreshed every 60 seconds

### Settings
- User profile management with avatar and logo upload
- Appointment type and location configuration (soft-delete support)
- Multi-user support with role-based access (`SUPER_ADMIN`, `ADMIN`, `VIEWER`)
- Banking info configuration for payment notifications

---

## Tech Stack

### Frontend — `Portal/`

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 |
| UI Library | React 19 |
| Component Libraries | Ant Design 6 |
| Styling | Tailwind CSS v4, CSS Modules |
| Date Handling | dayjs |
| State | nuqs (URL query state) |
| Testing | Vitest, React Testing Library |

### Backend — `Server/`

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express 5 |
| Language | TypeScript 6 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Validation | Zod 4 |
| Scheduler | pg-boss 12 |
| Notifications | Twilio SDK 6 (WhatsApp + SMS) |
| Video Conferencing | Google Meet API |
| Security | Helmet, express-rate-limit, CORS, bcrypt |
| Auth | JWT (httpOnly cookies) with account lockout |
| Logging | Pino |
| Testing | Vitest |

---

## Architecture

The application follows a **clean layered architecture**:

```
Request → Routes → Service → Repository → Prisma → PostgreSQL
```

- **Routes** — Express route handlers, request validation (Zod schemas), response formatting
- **Service** — Business logic, ownership verification, cross-entity coordination
- **Repository** — Data access layer, Prisma queries, pagination helpers
- **Middleware** — Authentication (JWT), validation, async error handling, rate limiting

Key architectural patterns:
- **Multi-tenant by user** — All data is scoped to the authenticated user via `userId` foreign keys
- **Soft deletes** — Locations and appointment types use `isActive` flags rather than hard deletes
- **Optimistic audit trail** — Notifications create a `PENDING` record before dispatch, then update status (ensures audit trail even if the server crashes mid-send)
- **Background workers** — pg-boss queues/schedules for reminder dispatch, delivery tracking, and appointment auto-completion
- **Error boundaries** — React ErrorBoundary at root level catches render failures gracefully
- **Retry with backoff** — Frontend data-fetching hooks retry failed requests with exponential backoff
- **Entity mutation factories** — CRUD hooks generated via `useEntityMutation` factories to eliminate boilerplate

---

## Project Structure

```
PatientNova/
├── Portal/                       # Next.js 16 frontend
│   └── src/
│       ├── api/                  # Data-fetching hooks (useApiQuery, useApiMutation, entity factories)
│       ├── app/                  # Next.js App Router
│       │   ├── AuthContext.tsx   # Auth provider (session management, login/logout)
│       │   ├── providers.tsx     # Root providers (auth, error boundary, URL state)
│       │   ├── page.tsx          # Public landing page
│       │   ├── login/            # Login page
│       │   └── (protected)/      # Auth-guarded routes
│       │       ├── dashboard/    # Overview with stats, today's appointments, active reminders
│       │       ├── patients/     # Patient CRUD with search and filtering
│       │       ├── appointments/ # Appointment management with conflict detection
│       │       ├── calendar/     # Monthly calendar view
│       │       ├── reminders/    # Reminder management and bulk send wizard
│       │       ├── medical-records/ # Clinical history per patient
│       │       └── settings/     # Profile, locations, appointment types, security
│       ├── components/           # Shared UI components
│       │   ├── Drawers/          # Create/edit side panels
│       │   ├── Info/             # Stat cards, status pills, badges
│       │   ├── Modals/           # Confirmation dialogs, appointment/reminder modals
│       │   └── MedicalRecord/    # Medical record PDF and document components
│       ├── config/               # Theme, icons, and app configuration
│       ├── hooks/                # Custom React hooks
│       ├── styles/               # Global CSS, Ant Design theme, PDF styles
│       ├── types/                # TypeScript interfaces and enums
│       ├── utils/                # Helpers (formatting, time, avatar, debounce)
│       └── test/                 # Vitest test suites
│
├── Server/                       # Express 5 backend
│   ├── schema.prisma             # Prisma schema (models, indexes, enums)
│   └── src/
│       ├── auth/                 # Login, logout, session refresh, account lockout
│       ├── users/                # User CRUD, password change, role management
│       ├── patients/             # Patient CRUD with search, stats, ownership checks
│       ├── appointments/         # Appointment CRUD, conflict detection, stats, auto-complete
│       ├── appointment-types/    # Configurable types (soft-delete)
│       ├── locations/            # Configurable locations (soft-delete)
│       ├── reminders/            # Reminder CRUD, stats, status management
│       ├── medical-records/      # Clinical records with family members, evolution notes
│       ├── consent-document/     # Consent document management and public download
│       ├── notify/               # Immediate WhatsApp/SMS dispatch
│       ├── twilio/               # Twilio client wrapper, webhook handler, signature validation
│       ├── google/               # Google Meet integration
│       ├── scheduler/            # pg-boss workers (reminders, delivery tracking, appointment auto-complete, daily summary)
│       ├── middlewares/          # Auth (JWT), Zod validation, async error handler
│       ├── prisma/               # Prisma client, seed scripts
│       └── utils/                # Config, logger, errors, pagination, time helpers, encryption
│
└── Bruno Collection/             # Bruno API collection (manual testing)
```

---

## Getting Started

### Prerequisites

- **Node.js 22+**
- **PostgreSQL** database
- A [Twilio](https://www.twilio.com) account with:
  - A WhatsApp-enabled sender (Sandbox or approved number)
  - An SMS-enabled phone number
  - Approved Content Template SIDs for WhatsApp messages

### Environment Variables

**Backend** — copy `Server/.env.example` to `Server/.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | JWT signing secret (generate with `openssl rand -hex 64`) |
| `ENCRYPTION_KEY` | AES-256-GCM key for field encryption (generate with `openssl rand -hex 32`) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | WhatsApp sender (e.g. `whatsapp:+14155238886`) |
| `TWILIO_SMS_FROM` | SMS sender phone number |
| `TWILIO_WEBHOOK_BASE_URL` | Public URL for Twilio webhooks |
| `TWILIO_WHATSAPP_*_SID` | Content Template SIDs for various appointment scenarios |
| `ALLOWED_ORIGINS` | JSON array of allowed CORS origins |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Initial admin account credentials |
| `BCRYPT_ROUNDS` | Password hashing rounds (default: `12`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google service account for Meet integration |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google service account private key |
| `GOOGLE_MEET_ORGANIZER_EMAIL` | Email to organizer Google Meet links |

**Frontend** — copy `Portal/.env.example` to `Portal/.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:3001`) |

### Installation

```bash
# Backend
cd Server
npm install
npx prisma migrate deploy
npm run db:seed-admin        # Creates the initial admin user

# Frontend
cd Portal
npm install
```

### Running the App

**Development:**
```bash
# Terminal 1 — Backend (hot reload)
cd Server
npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend (hot reload)
cd Portal
npm run dev
# → http://localhost:3000
```

**Production:**
```bash
# Backend
cd Server
npm run build
npm start          # Runs migrations, seeds admin, starts server

# Frontend
cd Portal
npm run build
npm start          # Starts Next.js production server
```

---

## API Reference

All endpoints require authentication via JWT cookie (except `/health`, `/auth/login`, and Twilio webhooks).

### Response Format

Success:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-03-22T12:00:00.000Z"
}
```

Paginated:
```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

Error:
```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2026-03-22T12:00:00.000Z"
}
```

### Endpoints

#### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate and set session cookie |
| `POST` | `/auth/logout` | Clear session cookie |
| `POST` | `/auth/refresh` | Refresh JWT token |

#### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | DB connectivity check and service uptime |
| `GET` | `/messages/:messageSid` | Fetch live Twilio delivery status (rate-limited) |

#### Users
| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me` | Get current user profile |
| `GET` | `/users` | List all users (Super Admin only) |
| `POST` | `/users` | Create a new user (Super Admin only) |
| `PATCH` | `/users/:id` | Update user profile |
| `POST` | `/users/change-password` | Change password |

#### Patients
| Method | Path | Description |
|---|---|---|
| `GET` | `/patients` | List patients (search, status, pagination, sorting) |
| `GET` | `/patients/stats` | Count breakdown by status |
| `GET` | `/patients/:id` | Get single patient with relations |
| `POST` | `/patients` | Create a new patient |
| `PATCH` | `/patients/:id` | Partially update a patient |
| `DELETE` | `/patients/:id` | Delete a patient |

#### Appointments
| Method | Path | Description |
|---|---|---|
| `GET` | `/appointments` | List appointments (patient, status, dates, paid, pagination) |
| `GET` | `/appointments/stats` | Revenue and status aggregates |
| `GET` | `/appointments/:id` | Get appointment with linked patient and reminder |
| `POST` | `/appointments` | Create appointment (with conflict detection) |
| `PATCH` | `/appointments/:id` | Update appointment (with conflict detection on time changes) |
| `POST` | `/appointments/:id/pay` | Mark as paid |
| `POST` | `/appointments/:id/cancel` | Cancel appointment |
| `DELETE` | `/appointments/:id` | Delete appointment |

#### Appointment Types & Locations
| Method | Path | Description |
|---|---|---|
| `GET` | `/appointment-types` | List active appointment types |
| `POST` | `/appointment-types` | Create type |
| `PATCH` | `/appointment-types/:id` | Update type (including soft-delete via `isActive`) |
| `GET` | `/locations` | List active locations |
| `POST` | `/locations` | Create location |
| `PATCH` | `/locations/:id` | Update location (including soft-delete via `isActive`) |

#### Reminders
| Method | Path | Description |
|---|---|---|
| `GET` | `/reminders` | List reminders (status, channel, patient, dates, pagination) |
| `GET` | `/reminders/stats` | Count by status and channel |
| `GET` | `/reminders/:id` | Get single reminder with linked appointment |
| `POST` | `/reminders` | Create a new reminder |
| `PATCH` | `/reminders/:id` | Update a reminder |
| `POST` | `/reminders/:id/cancel` | Cancel a pending reminder |
| `DELETE` | `/reminders/:id` | Delete a reminder |

#### Notify (Immediate Dispatch)
| Method | Path | Description |
|---|---|---|
| `POST` | `/notify/whatsapp` | Send immediate WhatsApp message |
| `POST` | `/notify/sms` | Send immediate SMS |

#### Medical Records
| Method | Path | Description |
|---|---|---|
| `GET` | `/medical-records/:patientId` | Get patient's medical record |
| `PUT` | `/medical-records/:patientId` | Create or update medical record (atomic transaction) |

---

## Database Schema

The database uses PostgreSQL with Prisma ORM. Key models:

### Core Models

| Model | Purpose | Key Fields |
|---|---|---|
| `User` | Admin users | email, role (`SUPER_ADMIN`/`ADMIN`/`VIEWER`), status, timezone, banking info |
| `Patient` | Patient records | name, contact info, status (`ACTIVE`/`INACTIVE`) |
| `Appointment` | Scheduled visits | startAt, endAt, timezone, price, currency, status, paid |
| `Reminder` | Notifications | channel, to, status, sendMode, sendAt, messageId |
| `MedicalRecord` | Clinical history | consultation reason, development, lifestyle, trauma, mental history |
| `FamilyMember` | Patient family | name, sex, age, relationship |
| `EvolutionNote` | Progress notes | date, text (timestamped entries) |
| `AppointmentLocation` | Configurable venues | name, color, bg, isActive |
| `AppointmentType` | Visit categories | name, defaultDuration, defaultPrice, isActive |

### Relationships

- A **User** owns many **Patients** (multi-tenant isolation)
- A **Patient** has many **Appointments**, many **Reminders**, and one optional **MedicalRecord**
- A **MedicalRecord** has many **FamilyMembers** and many **EvolutionNotes**
- An **Appointment** optionally links to one **Reminder** (one-to-one)
- **Appointments** reference an **AppointmentType** and **AppointmentLocation**

### Indexes

Composite indexes are defined for common query patterns:
- `Patient`: `[userId, status]`, `[userId, email]` (unique), `[name]`, `[lastName]`
- `Appointment`: `[startAt, status]`, `[patientId]`, `[locationId]`, `[typeId]`
- `Reminder`: `[status, sendAt]`, `[patientId]`

---

## Notification System

### Immediate Dispatch

Call `POST /notify/whatsapp` or `POST /notify/sms`:

1. A `PENDING` reminder record is created first (audit trail)
2. The message is sent via Twilio API
3. On success: status → `SENT`, Twilio `messageSid` stored
4. On failure: status → `FAILED`, error message recorded

This **create-first-then-send** pattern ensures an audit trail exists even if the server crashes between sending and recording.

### Scheduled Dispatch

1. Create a reminder via `POST /reminders` with `sendMode: "SCHEDULED"` and a future `sendAt`
2. The background **reminderWorker** polls every minute for `PENDING` reminders with `sendAt ≤ now`
3. Each matching reminder is dispatched through Twilio
4. Status is updated to `SENT` or `FAILED` with the result

WhatsApp messages require a Twilio **Content Template SID** (`contentSid`) and optionally `contentVariables` for template placeholders — required by WhatsApp Business API policy.

---

## Background Workers

Background work is orchestrated by **pg-boss** (Postgres-backed job queue) with four queues/schedules:

| Queue / Schedule | Worker | Purpose |
|---|---|---|
| `send-reminder` (per-reminder jobs) | `sendReminderWorker` | Dispatches `PENDING` reminders whose `sendAt` time has passed. On send, enqueues a `track-delivery` job to poll Twilio for status updates. Failed jobs retry with backoff and dead-letter. |
| `track-delivery` (every 5 min) | `trackDeliveryWorker` | Polls Twilio for stale `SENT` messages (>30 min with no confirmation) and marks them `FAILED`. |
| `complete-appointments` (every 15 min) | `completeAppointmentsWorker` | Auto-transitions `SCHEDULED`/`CONFIRMED` appointments to `COMPLETED` when more than 1 hour past `endAt`. |
| `daily-reminder` (hourly) | `dailyReminderWorker` | Sends a daily "tomorrow's appointments" summary via WhatsApp to users with reminders enabled. |

All workers:
- Start automatically on server boot via `initializePgBoss()` (requires `ENABLE_SCHEDULER=true`)
- Shut down cleanly on `SIGTERM`/`SIGINT` via `stopPgBoss({ graceful: true })`
- Are wrapped in error handling — a failure in one cycle logs the error and lets pg-boss retry

---

## Security

- **Authentication** — JWT tokens stored in httpOnly, secure cookies with configurable sameSite policy
- **Account lockout** — Configurable max failed attempts and lockout duration
- **Timing-safe login** — Dummy bcrypt comparison on unknown emails to prevent user enumeration
- **Field encryption** — Sensitive fields (banking info, medical data) encrypted at rest with AES-256-GCM
- **Input validation** — All request bodies and query parameters validated via Zod schemas
- **IANA timezone validation** — Timezone strings validated against the Intl API
- **Rate limiting** — Global rate limiter + dedicated limit on message status endpoint
- **CORS** — Configurable allowed origins
- **Helmet** — Standard HTTP security headers
- **Soft-delete filtering** — Inactive locations and appointment types are excluded from list queries
- **Email normalization** — Emails lowercased on creation to prevent case-based duplicates
- **Input sanitization** — Twilio message SIDs validated against regex pattern before API calls

---

## Testing

```bash
# Server tests (168 tests across 12 suites)
cd Server
npm test                 # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report

# Dashboard tests (41 tests across 4 suites)
cd Portal
npm test                 # Run once
npm run test:watch       # Watch mode
```

Test suites cover:
- **Server**: Service logic (patients, appointments, reminders, medical records, auth, users, locations, appointment types, consent documents, Google Meet), error handling, Prisma error mapping, pagination utilities, time utilities, encryption
- **Dashboard**: API query/mutation hooks (loading, error, retry, refetch), time formatting, query string building
