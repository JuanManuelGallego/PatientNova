# Operations runbook

Everything here is about running PatientNova safely in production. Keep it short and true: if a
step is not actually in place, say so (the privacy policy must never promise more than this file).

## Deploying the API

`pnpm start` runs `prisma migrate deploy`, seeds the admin and starts the server. That is fine for a
single instance, but a failing migration then crash-loops the service. Preferred setup:

1. Release step (runs once per deploy, before new instances start): `pnpm run migrate:deploy`
2. Start command: `pnpm run start:app` (just `node dist/server.js`)

Migrations that rely on data assumptions (exclusion constraint on appointments, normalized-email
unique index) fail loudly if the assumption is false. Before deploying those, run them against a
restored copy of production.

Raw-SQL-only database objects (not visible to Prisma) are listed in `AGENTS.md`.
`CREATE EXTENSION btree_gist` needs a role allowed to create extensions (typically the database
owner on managed Postgres); verify on the production database before the first deploy.

### Forced re-login
Token audience/issuer enforcement (`src/auth/tokens.ts`) invalidates every existing provider
session on first deploy. Announce it and deploy outside clinic hours.

## Backups and restore (PostgreSQL)

Status: **to be confirmed with the hosting provider.** Do not claim backups exist in any user-facing
text until each box below is ticked.

- [ ] Automated daily backups enabled at the provider, retention >= 14 days
- [ ] Point-in-time recovery enabled (if offered)
- [ ] Backups encrypted at rest
- [ ] A restore was rehearsed into a scratch database in the last 90 days (date: ____)

Manual logical backup (also useful before risky migrations):

```bash
pg_dump --format=custom --no-owner --file patientnova-$(date +%F).dump "$DATABASE_URL"
```

Restore into a scratch database and verify:

```bash
createdb patientnova_restore
pg_restore --no-owner --dbname patientnova_restore patientnova-YYYY-MM-DD.dump
psql patientnova_restore -c 'SELECT count(*) FROM appointments;'
```

Patient data is sensitive personal data under Ley 1581 de 2012: store dumps encrypted, restrict
access, delete scratch copies after the rehearsal.

## Error tracking (Sentry, optional)

- API: set `SENTRY_DSN` (and optionally `SENTRY_RELEASE`). Only 5xx/unexpected errors are reported.
- Portal: set `NEXT_PUBLIC_SENTRY_DSN` at build time. The CSP `connect-src` is extended automatically.
- Both sides disable every automatic data collector and scrub events (`scrub.ts`): no request bodies,
  cookies, headers, query strings, breadcrumbs or user details; emails/phone numbers in messages are
  masked. Do not add integrations that re-enable request capture.
- Sentry is a third-party processor: list it in the privacy policy before enabling it in production.

## CSP rollout (Portal)

The Content-Security-Policy ships as `Content-Security-Policy-Report-Only`. After a staging soak with
no console violations, set `CSP_ENFORCE=true` for the Portal build to enforce it.

## End-to-end tests

CI runs Playwright against a throwaway stack (Postgres + API + Portal inside the job, seeded by
`pnpm run db:seed-e2e`). Locally: start a database whose name contains `test` or `e2e`, run the API and
the Portal, then `pnpm e2e` in `Portal/` with the variables from the `e2e` job in `.github/workflows/ci.yml`.
The suite runs serially because one provider has one calendar and overlapping appointments are rejected.
