# Portal Booking Confirmed by Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patients book without a login code: "Reservar" holds the slot for 1 hour as an UNCONFIRMED booking request and sends a confirmation link by email or WhatsApp; the click (a button POST) proves the contact and runs today's booking/approval rules. OTP login is removed and "Mis citas" is gated behind `ENABLE_SELF_SERVE` (off).

**Architecture:** An unconfirmed booking is a `BookingRequest` with the new status `UNCONFIRMED`, holding its slot like a PENDING hold (slot engine + exclusion constraint) but invisible to the provider. Two random secrets are stored only as SHA-256 hashes on the row: the confirm token (sent in the link) and the release token (returned to the booking browser). Confirmation runs, under the provider lock, the same patient-resolution → cap → consent → `createPortalAppointmentWithin` pipeline `book` runs today (auto-confirm), or turns the row into a normal PENDING request (approval/review).

**Tech Stack:** Node/TypeScript, Express, Prisma 7 (Postgres), pg-boss, Vitest; Next.js (App Router), React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-portal-booking-confirmation-link-design.md` (approved). Read it and the repo `AGENTS.md` before any task.

## Global Constraints

- Work on a new branch from `staging` (e.g. `portal-confirm-link`). The working tree has unrelated uncommitted changes in `Portal/src/components/Settings/OnlineBookingTab.tsx`, `Portal/src/utils/bookingAvailability.ts` and their tests: never stage or modify them.
- Unconfirmed hold: `min(now + 60 min, startAt)`. After the click in approval/review: today's `holdExpiry(now, startAt)` (48h).
- Caps: per contact 3 live holds (UNCONFIRMED + PENDING, by contact hash); per provider **5** live UNCONFIRMED; per provider 50 live PENDING (unchanged, UNCONFIRMED not counted).
- WhatsApp paid caps (counted on `booking_requests` rows with `contactChannel = WHATSAPP`): 3 requests per number per hour; 30 distinct numbers per provider per hour; `PORTAL_WHATSAPP_DAILY_CAP` (default 30, prod 300) distinct numbers per 24h across providers. Checked under the provider lock **before** the hold; a hit cap creates nothing and answers `WhatsAppUnavailableError`. Log at error level `Portal WhatsApp cap reached: <phone-cap|provider-paid-cap|paid-daily-cap>` with no PII.
- Confirmation channels: `EMAIL` and `WHATSAPP` only, chosen by the patient.
- Confirming happens only on POST. Nothing on GET or page load changes state.
- Tokens: 32 random bytes, base64url; stored as SHA-256 hex; never logged, never in an API URL (always in a JSON body), never sent to Sentry.
- No patient lookup, patient write, consent row or appointment before confirmation. Booking responses are identical regardless of patient existence.
- Provider never sees UNCONFIRMED rows, nor EXPIRED/CANCELLED rows with `confirmedAt = null` (inbox, count, detail, notices).
- New env: `TWILIO_WHATSAPP_PATIENT_PORTAL_CONFIRM_LINK_SID`, `TWILIO_WHATSAPP_PATIENT_PORTAL_BOOKING_UNCONFIRMED_SID` (required), `ENABLE_SELF_SERVE` (`'true'` enables, default off), `PORTAL_WHATSAPP_DAILY_CAP`. Removed: `TWILIO_WHATSAPP_PATIENT_PORTAL_OTP_SID`, `PORTAL_OTP_PAID_DAILY_CAP`. Each change goes to `Server/.env.test`, `.github/workflows/ci.yml`, `Server/.env.example` and local `Server/.env` (AGENTS.md).
- Confirmation link: `${PORTAL_URL}/book/confirmar/<token>`; `confirmar` becomes a reserved slug.
- Spanish patient copy; no full stop right after a formatted time ("a. m."/"p. m."); no empty WhatsApp variable.
- Every transactional `logAudit` uses `tx` + `required: true`; request audit rows never carry name/email/phone.
- After `schema.prisma` changes: `pnpm exec prisma generate` (committed client).

## Review Focus

1. **Link scanners.** Outlook/Gmail safe-link scanners GET the link and may run the page's JS. Viewing must never confirm; only the button's POST does. → Task 5 test `view never changes state`, Task 9 test `does not confirm on load`.
2. **Double click / two tabs.** Two concurrent confirms of one token must yield one appointment and one patient, and the second answer is the confirmed state, not an error. → Task 5 test `concurrent confirms create one appointment`.
3. **Click after the hour, before the sweep.** Expiry is by clock: a click at `holdExpiresAt + 1s` with the row still UNCONFIRMED shows "expired" and creates nothing. → Task 5 test `late click is expired even before the sweep`.
4. **Booking paused or patient blocked between booking and click.** Confirm answers unavailable and releases the hold (row CANCELLED, `resolvedBy: 'system'`) so the slot frees immediately. → Task 5 test `releases the hold when confirmation is refused`.
5. **Two unconfirmed bookings from the same new email, both confirmed.** One patient record, two appointments (cap permitting). → Task 5 test `two confirmations by the same new email create one patient`.

---

## File Structure

**Server — create**
- `Server/migrations/20261109000000_booking_unconfirmed/migration.sql` — enum value, columns, backfill.
- `Server/migrations/20261109000100_booking_unconfirmed_hold/migration.sql` — constraint over both holding statuses.
- `Server/migrations/20261109000200_drop_portal_otps/migration.sql` — drop `portal_otps` (Task 7).
- `Server/src/booking-requests/request-token.ts` — issue/hash secrets.
- `Server/src/portal/portal-paid-caps.ts` — WhatsApp cost caps on request rows.
- `Server/src/portal/booking-start.service.ts` — create unconfirmed hold, send link, release.
- `Server/src/portal/booking-confirmation.service.ts` — view and confirm.
- `Server/src/portal/booking-confirmation.dto.ts` — `BookingPendingDto`, `BookingConfirmationView`.
- `Server/src/portal/booking-confirmation.routes.ts` — public routes.
- `Server/src/portal/booking-confirmation.errors.ts` — new errors.
- Tests: `Server/test/integration/portal/booking-start.integration.test.ts`, `booking-confirmation.integration.test.ts`, `booking-unconfirmed-expiry.integration.test.ts`, `self-serve-flag.integration.test.ts`; `Server/test/unit/portal/portal-paid-caps.test.ts` (pure helpers), `Server/test/unit/booking-requests/request-token.test.ts`.

**Server — modify**
- `Server/schema.prisma`, `src/booking-requests/booking-request.{constants,repository,service}.ts`, `booking-request-notifications.ts`, `booking-request-review.service.ts` (only if it reads `countLive`), `src/portal/{portal-booking.service,portal-booking.routes,portal-booking.schemas,portal-routers,patient-notices,portal-contact}.ts`, `src/brevo/email-templates.ts`, `src/public-booking/public-booking.service.ts`, `src/booking-settings/slug.ts`, `src/audit-log/audit-actors.ts`, `src/utils/config/config.ts`, `src/scheduler/pg-boss.ts`.

**Server — delete**
- `src/portal/portal-otp.{errors,repository,routes,schemas,service}.ts`, `src/scheduler/workers/purge-portal-otps.ts`, tests `portal-otp.integration.test.ts`, `portal-phone-otp.integration.test.ts`.
- In `src/portal/portal-request.service.ts` delete `holdSlotWithin`, `HeldSlot` and `afterRequestCreated`; keep `portalRequestService.list/cancel` (the gated self-serve routes use them). Delete `bookingRequestService.createHoldWithin` and `bookingRequestRepository.countLive` once nothing calls them (Task 7).

**Portal — create**
- `Portal/src/app/book/confirmar/[token]/page.tsx`, `Portal/src/components/PublicBooking/BookingConfirmationPage.tsx`, `PatientDetailsStep.tsx`, `ProviderContactNotice.tsx`, `Portal/src/api/portal/useBookingConfirmation.ts`.
- Tests: `Portal/test/components/BookingConfirmationPage.test.tsx`, `PatientDetailsStep.test.tsx`.

**Portal — modify / delete**
- Modify: `BookingFlow.tsx`, `BookingResult.tsx`, `useBookingFlow.ts`, `PortalAppointmentsPage.tsx`, `PublicBookingPage.tsx`, `src/types/{PublicBooking,PortalBooking,PortalSession}.ts`, `src/utils/publicBooking.ts`, `src/config/consentText.ts`, `test/components/{useBookingFlow,PublicBookingPage,PortalAppointmentsPage}.test.*`, `test/proxy.test.ts`.
- Delete: `PatientSteps.tsx`, `PortalLogin.tsx`, OTP hooks in `src/api/portal/usePortalAuth.ts` (`useRequestOtp`, `useVerifyOtp`).
- E2E: `e2e/support/{portal.ts,mock-brevo.mjs}`, `e2e/tests/public/{booking,book,approval,review}.spec.ts`; delete `portal-login.spec.ts`.

**Docs**: `AGENTS.md`, `docs/operations.md`, `docs/compliance-patient-data.md`, `docs/legal/versions/2026-11-09/`, `Bruno Collection/`.

---

### Task 1: Data model — UNCONFIRMED holds

**Files:**
- Modify: `Server/schema.prisma` (enum `BookingRequestStatus`, model `BookingRequest`)
- Create: both migrations listed above
- Modify: `Server/src/booking-requests/booking-request.constants.ts`, `booking-request.repository.ts`
- Create: `Server/src/booking-requests/request-token.ts`
- Test: `Server/test/integration/booking-requests/unconfirmed-hold.integration.test.ts`, `Server/test/unit/booking-requests/request-token.test.ts`

**Interfaces:**
- Produces:
  - `BookingRequestStatus.UNCONFIRMED`; `BookingRequest` fields `confirmedAt DateTime?`, `confirmTokenHash String? @unique @db.VarChar(64)`, `releaseTokenHash String? @unique @db.VarChar(64)`, `confirmationSentAt DateTime?`.
  - constants: `UNCONFIRMED_HOLD_MINUTES = 60`, `MAX_UNCONFIRMED_PER_PROVIDER = 5`, `UNCONFIRMED_RETENTION_HOURS = 48`, `unconfirmedHoldExpiry(now: Date, startAt: Date): Date`.
  - `issueRequestToken(): { token: string; hash: string }`, `hashRequestToken(token: string): string`.
  - repository: `HOLDING_STATUSES` (PENDING, UNCONFIRMED); `countLiveHolds(userId, now, tx, own?)` (both statuses, per-contact cap); `countLivePending(userId, now, tx)` (50 cap); keep the old `countLive` untouched until Task 7 removes its last caller; `countLiveUnconfirmed(userId, now, tx)`; `createUnconfirmed(data: CreateBookingRequestData & { confirmTokenHash: string; releaseTokenHash: string }, tx)`; `findByConfirmTokenHash(hash, tx?)`; `findByReleaseTokenHash(hash, tx)`; `markConfirmationSent(id, now)`; `findStale` returns `{ id, status, confirmedAt, confirmationSentAt }` for both holding statuses.

- [ ] **Step 1: Write failing tests** (`unconfirmed-hold.integration.test.ts`)

```ts
it('an UNCONFIRMED live hold blocks its slot in loadLiveHolds and in public slots', ...)
  // create via repository.createUnconfirmed; expect publicBookingService.getSlots to omit startAt
it('the exclusion constraint rejects an UNCONFIRMED hold overlapping a PENDING one', ...)
  // raw insert overlapping → expect isAppointmentOverlapViolation(err) true
it('provider inbox never lists UNCONFIRMED, nor EXPIRED/CANCELLED rows with confirmedAt null', ...)
  // listForProvider for all three tabs, countPending, findForProvider → none of those ids
it('countLiveHolds counts both statuses; countLivePending only PENDING; countLiveUnconfirmed only UNCONFIRMED', ...)
it('findByConfirmTokenHash and findByReleaseTokenHash find the row by hash only', ...)
```

Test rows that represent today's confirmed requests must set `confirmedAt` (the backfill does this for existing data; update the shared request factory in `test/integration/helpers.ts`, or the `booking-requests` tests' local factory, to default `confirmedAt: new Date()`).

`request-token.test.ts`: token is 43 base64url chars; `hashRequestToken(token) === hash`; two issues differ.

- [ ] **Step 2: Run, expect FAIL** — `cd Server && pnpm vitest run --project integration test/integration/booking-requests/unconfirmed-hold.integration.test.ts` → fails (no UNCONFIRMED).

- [ ] **Step 3: Schema + migrations**
  - Migration A (`20261109000000_booking_unconfirmed`): `ALTER TYPE "BookingRequestStatus" ADD VALUE 'UNCONFIRMED';` add the four columns, unique indexes on both hash columns, `UPDATE "booking_requests" SET "confirmedAt" = "createdAt";`. Enum values cannot be used in the same transaction they are added in, hence migration B.
  - Migration B (`20261109000100_booking_unconfirmed_hold`): `ALTER TABLE booking_requests DROP CONSTRAINT booking_requests_no_hold_overlap;` re-add identical but `WHERE (status IN ('PENDING','UNCONFIRMED'))`. (`portal_otps` is dropped in Task 7, together with the code that uses it.)
  - Generate with `pnpm exec prisma migrate dev --create-only`, then hand-edit and **remove any generated `DROP INDEX`/`DROP CONSTRAINT` for the raw-SQL objects listed in AGENTS.md**. Run `pnpm exec prisma generate`.

- [ ] **Step 4: Repository** — `liveHoldWhere` uses `status: { in: HOLDING_STATUSES }`; `tabWhere`, `listForProvider`, `findForProvider`, `countPending`, `findNudgeCandidates` add `confirmedAt: { not: null }` (PENDING-only clauses stay PENDING). `purgeResolvedBefore` excludes both holding statuses. Remove `create` callers only in Task 4.

- [ ] **Step 5: Run tests, expect PASS**; also run `pnpm vitest run --project integration test/integration/booking-requests` (existing inbox tests still green).

- [ ] **Step 6: Update AGENTS.md raw-SQL list** — `booking_requests_no_hold_overlap` now covers `status IN ('PENDING','UNCONFIRMED')`, migration `20261109000100_booking_unconfirmed_hold`.

- [ ] **Step 7: Commit** — `feat(booking-requests): UNCONFIRMED holds with token hashes`

---

### Task 2: Config, notices and email templates

**Files:**
- Modify: `Server/src/utils/config/config.ts`, `.env.test`, `.env.example`, `.env`, `.github/workflows/ci.yml`
- Modify: `Server/src/portal/patient-notices.ts`, `Server/src/brevo/email-templates.ts`, `Server/src/portal/portal-booking-notifications.ts` (load `publicPhone`, `publicWhatsapp`)
- Modify: `Server/src/booking-settings/slug.ts` (add `'confirmar'`)
- Test: `Server/test/unit/portal/patient-notices.test.ts`, `Server/test/unit/portal/config-limits.test.ts`

**Interfaces:**
- Produces:
  - `config.twilio.patientPortal.confirmLinkSid`, `.unconfirmedExpiredSid`. `config.portal.selfServe: boolean`; `config.portal.whatsappDailyCap: number` (`positiveIntEnv('PORTAL_WHATSAPP_DAILY_CAP', 30)`). `otpSid` and `otpPaidDailyCap` (and their env vars) stay until Task 7 deletes the OTP code that reads them.
  - `interface ProviderContact { phone: string | null; whatsapp: string | null }`.
  - New notice kinds: `'confirm-link': Timed & PlaceParams & { token: string; confirmUrl: string; approvalRequired: boolean; providerContact: ProviderContact }` and `'unconfirmed-expired': Timed & { bookingUrl: string }`.
  - `appointmentsUrl` becomes optional (`appointmentsUrl?: string`) on `confirmation`, `reschedule`, `meeting-link`; renderers omit the "Ver mis citas" line when absent. `providerContact?: ProviderContact` added to `confirmation`, `reschedule`, `meeting-link`; emails render `contactProviderLine`.
  - `confirmationUrl(token: string): string` = `${portal base}/book/confirmar/${token}` (exported from `patient-notices.ts`).

- [ ] **Step 1: Failing unit tests** (`patient-notices.test.ts`)

```ts
it('confirm-link by WhatsApp uses the confirm-link template with the token as the URL-button variable', () => {
  const opts = renderPatientNotice('confirm-link', params, { channel: Channel.WHATSAPP, to: '+573001112233' });
  expect(opts).toMatchObject({ contentSid: config.twilio.patientPortal.confirmLinkSid,
    contentVariables: { '1': 'Dra. Ana', '2': expect.any(String), '3': expect.stringMatching(/m\.$/), '4': params.token } });
});
it('confirm-link by email says the appointment is not confirmed until the click, links confirmUrl, and names the 1-hour limit', () => {
  const { subject, html, text } = renderPatientNotice('confirm-link', params, emailRoute) as RenderedEmail & { to: string };
  expect(text).toContain('no está confirmada'); expect(text).toContain(params.confirmUrl); expect(text).toContain('1 hora');
});
it('confirm-link email tells the patient to contact the provider to change or cancel', () => {
  expect(text).toContain('comunícate directamente'); expect(text).toContain('+573001234567');
});
it('unconfirmed-expired by WhatsApp uses its own template, never request-expired', ...)
it('confirmation email omits "Ver mis citas" without appointmentsUrl and shows the provider contact line', ...)
it('no WhatsApp variable is empty for a provider without publicWhatsapp', ...)
```

`config-limits.test.ts`: rewrite for `PORTAL_WHATSAPP_DAILY_CAP` (non-numeric throws `PORTAL_WHATSAPP_DAILY_CAP must be a positive integer`).

- [ ] **Step 2: Run, expect FAIL** — `cd Server && pnpm vitest run --project unit test/unit/portal`
- [ ] **Step 3: Implement** config + env files (all four places) + notices + email templates. Email copy (exact, Spanish):
  - Subject confirm-link: `Confirma tu cita con {provider}` (approval: `Confirma tu solicitud de cita con {provider}`).
  - Body lead: `Tu cita del {when} todavía no está confirmada. Confírmala en la próxima 1 hora con este enlace; si no, el horario quedará libre.` (approval: `Tu solicitud de cita del {when} todavía no se ha enviado. Confírmala en la próxima 1 hora…`).
  - `contactProviderLine`: `Para cancelar o cambiar tu cita, comunícate directamente con {provider}: {phone}[ o WhatsApp {whatsapp}]` (omit missing parts; no line at all if both null).
  - unconfirmed-expired subject `Tu reserva con {provider} no se confirmó`, body `No confirmaste tu cita del {when}, así que el horario quedó libre. Puedes reservar de nuevo aquí: {bookingUrl}`.
  - SMS texts required by `NoticeTemplate` mirror the email leads (never sent: channel is EMAIL/WHATSAPP).
- [ ] **Step 4: Run, expect PASS**; `pnpm exec tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat(portal): confirmation-link notices, provider contact line, new env`

---

### Task 3: WhatsApp paid caps on booking requests

**Files:**
- Create: `Server/src/portal/portal-paid-caps.ts`
- Test: `Server/test/integration/portal/portal-paid-caps.integration.test.ts`

**Interfaces:**
- Produces: `type PaidCapReason = 'phone-cap' | 'provider-paid-cap' | 'paid-daily-cap'`; `PAID_CAP_LIMITS = { perPhonePerHour: 3, perProviderNumbersPerHour: 30 } as const`; `checkPaidCaps(tx: TransactionClient, userId: string, phoneHash: string, now: Date): Promise<PaidCapReason | null>` (counts `booking_requests` with `contactChannel = WHATSAPP`, `verifiedPhoneHash`, `createdAt` in window; distinct-number counts for provider/hour and all/24h vs `config.portal.whatsappDailyCap`).

- [ ] **Step 1: Failing tests**

```ts
it('allows 3 requests per number per hour, then phone-cap', ...)
it('counts distinct numbers per provider: the 31st new number in an hour is provider-paid-cap', ...)
it('daily cap counts distinct numbers across providers in 24h', ...) // vi.stubEnv PORTAL_WHATSAPP_DAILY_CAP small, re-import config
it('EMAIL requests never count', ...)
it('rows older than the window do not count', ...)
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run --project integration test/integration/portal/portal-paid-caps.integration.test.ts`
- [ ] **Step 3: Implement** with Prisma `count` and `groupBy`/`findMany distinct` on `verifiedPhoneHash`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(portal): WhatsApp cost caps counted on booking requests`

---

### Task 4: Start booking (anonymous) and release

**Files:**
- Create: `Server/src/portal/booking-start.service.ts`, `booking-confirmation.dto.ts`, `booking-confirmation.errors.ts`, `booking-confirmation.routes.ts`
- Modify: `Server/src/portal/portal-booking.schemas.ts`, `portal-routers.ts`, `src/audit-log/audit-actors.ts`, `src/booking-requests/booking-request.service.ts`
- Test: `Server/test/integration/portal/booking-start.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 repository/constants/tokens, Task 2 `renderPatientNotice('confirm-link', …)` + `confirmationUrl`, Task 3 `checkPaidCaps`.
- Produces:
  - `startBookingSchema` (strict): `{ typeId, locationId, startUtc, patientTimezone, consentAccepted: literal(true), captchaToken: string, patient: { name, lastName, phone?: e164OrEmpty }, contact: { channel: 'EMAIL', email } | { channel: 'WHATSAPP', phone: e164 } }`; `patient.phone` with `WHATSAPP` → 400 `phone is only for email bookings`. Type `StartBookingBody`.
  - `interface BookingPendingDto { channel: 'EMAIL' | 'WHATSAPP'; contact: string; startUtc: string; holdExpiresAt: string; approvalRequired: boolean; releaseToken: string }`.
  - `bookingStartService.start(slug: string, body: StartBookingBody, meta: ConsentRequestMeta): Promise<BookingPendingDto>`; `bookingStartService.release(releaseToken: string, meta: ConsentRequestMeta): Promise<void>`.
  - `bookingRequestService.createUnconfirmedWithin(tx, userId, input: NewBookingRequest & { confirmTokenHash; releaseTokenHash }, now): Promise<{ request; expiredIds }>` — expires stale first, creates with `unconfirmedHoldExpiry`, required audit `Reserva sin confirmar creada desde el portal` (no PII), enqueues **nothing** for the provider.
  - `portalAnonymousAuditContext({ userId, ipAddress })` in `audit-actors.ts` (actor id `'portal:anonymous'`, `ActionSource.PUBLIC_PORTAL`) — the contact is unproven, so it never becomes a portal actor.
  - Errors: `WhatsAppUnavailableError` (409, `Por ahora no podemos enviar mensajes por WhatsApp. Usa tu correo para reservar.`), `BookingHoldCapacityError` (429, `No hay cupo para nuevas reservas en este momento. Intenta de nuevo en un rato.`), `BookingReleaseNotFoundError` (404).
  - Routes (`createBookingConfirmationRoutes(): Router`, mounted in `createPublicApiRouter()` after `/providers` OTP removal): `POST /providers/:slug/bookings` (limiter `portal-booking-ip` 10/15 min → `validateBody(startBookingSchema)` → `requireCaptcha(createCaptchaVerifier(), 'booking')` → 202 `{ data: BookingPendingDto }`), `POST /booking-confirmations/release` body `{ releaseToken }` (limiter `booking-confirm-ip` 20/15 min) → 204.

- [ ] **Step 1: Failing tests** (`booking-start.integration.test.ts`, via `buildPortalApp()`, mock `dispatchMessage`/Brevo per AGENTS.md)

```ts
it('creates an UNCONFIRMED hold for 1 hour and emails the link after commit', async () => {
  const res = await startBooking(provider.slug, emailBody());
  expect(res.status).toBe(202);
  const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
  expect(row.status).toBe('UNCONFIRMED');
  expect(row.holdExpiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(60 * 60_000 + 1000);
  expect(row.confirmedAt).toBeNull(); expect(row.confirmationSentAt).not.toBeNull();
  expect(mocks.sendEmail.mock.calls[0][0].text).toMatch(/\/book\/confirmar\/[A-Za-z0-9_-]{43}/);
  expect(res.body.data.releaseToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
});
it('never stores the tokens in plaintext', ...) // row hashes !== tokens; hashRequestToken(token) === row.confirmTokenHash
it('touches no patient, consent or appointment, and answers byte-identically for a new email and a patient\'s email', ...)
it('sends WhatsApp through the confirm-link template with the token as variable 4', ...)
it('a hit WhatsApp cap creates nothing and answers 409 WhatsAppUnavailableError', ...)
it('the 6th live unconfirmed hold for a provider answers 429; confirmed PENDING requests do not count', ...)
it('the per-contact cap counts unconfirmed and pending together (4th → existing PortalRequestLimitError)', ...)
it('a held slot answers SlotUnavailableError 409 to a second patient', ...)
it('requires CAPTCHA and a strict body; patient.phone with WHATSAPP is 400', ...)
it('notifies the provider of nothing', ...)
it('a send failure keeps the hold, leaves confirmationSentAt null and still answers 202', ...)
it('release with the right token cancels the hold and frees the slot without any message', ...)
it('release with an unknown token, or of a confirmed request, answers 404 and changes nothing', ...)
it('never logs the token', ...) // spy logger; assert no call arg contains the token
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — order inside `prisma.$transaction` under `runInAuditContext(portalAnonymousAuditContext(...))`: `withProviderLock` → `resolveBookingMode` (404 when not live) → bookable type/location → `isSlotFree` → per-contact cap (`countLiveHolds` with `ownRequestWhere(contact)`) → `countLiveUnconfirmed >= MAX_UNCONFIRMED_PER_PROVIDER` → WhatsApp: `checkPaidCaps` → `createUnconfirmedWithin`. Contact stored as today (`email` or `verifiedPhone` + hash, `contactChannel`). After commit: send with `renderPatientNotice('confirm-link', …)`; on success `markConfirmationSent`; never throw, never log the token or `contentVariables`; deliver `expired` notices for `expiredIds` as `afterRequestCreated` did. Map conflicts via `toPortalError`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(portal): anonymous booking creates an unconfirmed hold and sends the link`

---

### Task 5: View and confirm

**Files:**
- Create/modify: `Server/src/portal/booking-confirmation.service.ts`, `booking-confirmation.dto.ts`, `booking-confirmation.routes.ts`, `booking-confirmation.errors.ts`
- Modify: `Server/src/portal/portal-booking.service.ts` (extract the auto-confirm core)
- Test: `Server/test/integration/portal/booking-confirmation.integration.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 4 (rows + tokens), existing `resolvePortalPatient(identity, tx)`, `ensureCurrentConsent`, `createPortalAppointmentWithin`, `enqueuePortalNotifications`, `enqueueBookingRequestNotifications`, `requestContact`.
- Produces:
  - `type ConfirmationState = 'unconfirmed' | 'confirmed' | 'requested' | 'expired' | 'unavailable'`.
  - `interface BookingConfirmationView { state: ConfirmationState; providerSlug: string; providerName: string; startUtc: string; patientTimezone: string; typeName: string; location: { name: string; address: string | null; isVirtual: boolean }; holdExpiresAt: string; approvalRequired: boolean; providerContact: ProviderContact }` — no patient name or contact.
  - State mapping: UNCONFIRMED and live → `unconfirmed`; UNCONFIRMED past `holdExpiresAt`, or EXPIRED/CANCELLED with `confirmedAt = null` and `resolvedBy !== 'system'` → `expired`; CANCELLED `resolvedBy: 'system'` → `unavailable`; APPROVED → `confirmed`; PENDING/REJECTED/EXPIRED with `confirmedAt` → `requested`.
  - `bookingConfirmationService.view(token: string): Promise<BookingConfirmationView>`; `bookingConfirmationService.confirm(token: string, meta: ConsentRequestMeta): Promise<BookingConfirmationView>`; unknown token → `BookingConfirmationNotFoundError` (404, `Este enlace no es válido.`).
  - `bookForIdentityWithin(tx, identity: PortalIdentity, input: { request: <row>, type, location, settings }, now): Promise<{ kind: 'appointment'; appointmentId: string; event: PortalEvent } | { kind: 'review' }>` in `portal-booking.service.ts` — the old auto-confirm branch of `book` (resolve → unavailable/no-review throws `PortalBookingUnavailableError` → create patient from the row's typed name/lastName/phone with `newPatientContact` / `typedPhoneIsUnverified` → `MAX_UPCOMING_PORTAL_BOOKINGS` → `ensureCurrentConsent(..., request.consentAcceptedAt)` → `createPortalAppointmentWithin({..., excludeRequestId: request.id })`).
  - Routes: `POST /booking-confirmations/view` `{ token }` → 200 view; `POST /booking-confirmations/confirm` `{ token }` → 200 view. Limiter `booking-confirm-ip` (shared with release). No CAPTCHA. `Cache-Control: no-store`.

- [ ] **Step 1: Failing tests**

```ts
it('view never changes state (scanner-safe)', async () => {
  await view(token); await view(token);
  expect((await row()).status).toBe('UNCONFIRMED');
  expect(await prisma.appointment.count()).toBe(0);
});
it('auto-confirm: creates patient, consent (accepted at booking time) and a CONFIRMED PORTAL appointment; row APPROVED with ids and confirmedAt', ...)
it('auto-confirm for a returning patient reuses the record and modifies nothing', ...)
it('approval mode: row becomes PENDING with a 48h hold, confirmedAt set, provider gets the received notice; no patient touched', ...)
it('review routing: an inactive match becomes a PENDING REVIEW request', ...)
it('concurrent confirms create one appointment', async () => {
  const [a, b] = await Promise.all([confirm(token), confirm(token)]);
  expect([a.body.data.state, b.body.data.state]).toEqual(['confirmed', 'confirmed']);
  expect(await prisma.appointment.count()).toBe(1);
});
it('a second confirm answers the confirmed state without side effects', ...)
it('late click is expired even before the sweep', ...) // vi.setSystemTime(holdExpiresAt + 1s) → state 'expired', nothing created
it('releases the hold when confirmation is refused', ...) // revoke portalAccessEnabled → 409 PortalBookingUnavailableError; row CANCELLED resolvedBy 'system'; slot free
it('releases the hold when booking is paused between booking and click', ...)
it('two confirmations by the same new email create one patient', ...)
it('the cap of 3 upcoming portal bookings applies at confirmation (409 PortalBookingLimitError, hold released)', ...)
it('the patient confirmation and provider notice are sent after commit (scheduler off)', ...)
it('an unknown token is 404 and the token never appears in logs', ...)
it('a WhatsApp confirmation proves the number: patient created with whatsappNumber and reminderChannel WHATSAPP', ...)
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — `confirm`: find row by `hashRequestToken(token)` (404 if none) → `runInAuditContext(portalPatientAuditContext({ userId, contact: requestContact(row), ipAddress }))` → `$transaction`: `withProviderLock` → re-read row on `tx`; not UNCONFIRMED → return view; past `holdExpiresAt` → return `expired` view; `resolveBookingMode` (throws `ProviderNotFoundError` → treat as refusal) → type/location still bookable (else refusal) → approval: update to PENDING (`confirmedAt: now`, `holdExpiresAt: holdExpiry(now, startAt)`), required audit, `enqueueBookingRequestNotifications('received', [id], tx)` → else `bookForIdentityWithin`; `review` → same as approval with `kind: REVIEW`; appointment → `resolve(APPROVED, resolvedBy: 'patient', confirmedAt, appointmentId, patientId)`, audit, `enqueuePortalNotifications(event, …)`. After commit: `deliverPortalNotificationsNow` / `deliverBookingRequestNotificationsNow('received', …)`. On `PortalBookingUnavailableError`, `PortalBookingLimitError`, `ProviderNotFoundError`, type/location 404 or `SlotUnavailableError`: in a new transaction under the lock, set row CANCELLED `resolvedBy: 'system'` (only if still UNCONFIRMED) with audit, then rethrow the neutral error. No `sendRequestReceipt` anywhere.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(portal): confirm a booking from its link`

---

### Task 6: Expiry message, sweep and purge

**Files:**
- Modify: `Server/src/booking-requests/booking-request.service.ts` (`expireStaleWithin`, `sweep`, `purgeResolved`), `booking-request.repository.ts` (`providersWithStale`, purge), `booking-request-notifications.ts`
- Test: `Server/test/integration/portal/booking-unconfirmed-expiry.integration.test.ts`

**Interfaces:**
- Produces: `BookingRequestEvent` gains `'unconfirmed-expired'` (patient event). `isDeliverable('unconfirmed-expired')` ⇔ `status === EXPIRED && confirmedAt === null && confirmationSentAt !== null`; `'expired'` additionally requires `confirmedAt !== null`. Audit `fieldsBefore.status` reflects the row's real previous status.

- [ ] **Step 1: Failing tests**

```ts
it('the sweep expires an unconfirmed hold and sends unconfirmed-expired by email', ...)
it('by WhatsApp it uses the unconfirmed-expired template, not request-expired', ...)
it('skips the expiry message when the confirmation link was never sent', ...)
it('sends nothing for a hold the patient released', ...)
it('a confirmed request that expires still gets the request-expired notice', ...)
it('the provider is never nudged or notified about unconfirmed holds', ...)
it('purges expired/cancelled unconfirmed rows after 48 hours, keeps confirmed rows 90 days', ...)
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — `findStale`/`providersWithStale` include UNCONFIRMED; `expireStaleWithin` enqueues `'expired'` for rows with `confirmedAt` and `'unconfirmed-expired'` for the rest; `purgeResolved` adds a second `deleteMany` for `confirmedAt: null, status notIn HOLDING_STATUSES, updatedAt < now − UNCONFIRMED_RETENTION_HOURS`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(booking-requests): expire unconfirmed holds and tell the patient`

---

### Task 7: Remove OTP, gate self-serve, public profile

**Files:**
- Delete: OTP files listed in File Structure, `purge-portal-otps` worker and tests.
- Modify: `Server/src/portal/portal-routers.ts`, `portal-booking.routes.ts`, `portal-contact.ts` (drop `portalLoginChannels`), `src/public-booking/public-booking.service.ts`, `src/scheduler/pg-boss.ts`, `src/utils/config/config.ts`, `test/integration/portal/portal-abuse.integration.test.ts`, `portal-helpers.ts`, existing portal tests that used `POST /v1/portal/bookings`.
- Test: `Server/test/integration/portal/self-serve-flag.integration.test.ts`

**Interfaces:**
- Produces: public profile drops `loginChannels`, adds `selfServe: boolean` (= `config.portal.selfServe`); `reschedulePolicy` is null unless `selfServe`. `createPortalSessionRouter()` mounts session and `/appointments*`, `/requests/:id/cancel` routes only when `config.portal.selfServe`; `POST /v1/portal/bookings` is removed in both states.

- [ ] **Step 1: Failing tests**

```ts
it('with ENABLE_SELF_SERVE off, /v1/portal/appointments, cancel, reschedule, slots, session and request cancel are 404', ...)
it('with it on, they are mounted (401 without a session)', ...) // vi.stubEnv + vi.resetModules + re-import routers
it('POST /v1/public/providers/:slug/otp and /v1/portal/:slug/otp/verify are 404', ...)
it('the public profile exposes selfServe and no loginChannels', ...)
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — delete OTP code, `holdSlotWithin`/`afterRequestCreated`, `createHoldWithin`, `countLive`; keep `portalRequestService.list/cancel` (used by gated routes). Remove `model PortalOtp` (and its `User` relation) from `schema.prisma`, add migration `20261109000200_drop_portal_otps` (`DROP TABLE "portal_otps";`, nothing else — strip generated drops of AGENTS.md raw-SQL objects), `pnpm exec prisma generate`. Remove `otpSid`, `otpPaidDailyCap` and the env vars `TWILIO_WHATSAPP_PATIENT_PORTAL_OTP_SID`, `PORTAL_OTP_PAID_DAILY_CAP` from all four env places. In `pg-boss.ts` remove the worker/queue registration and, once at start, `await boss.unschedule('purge-portal-otps').catch(() => {})` plus `deleteQueue` so the stored schedule stops firing. Move or delete tests: old `portal-booking.integration.test.ts` cases covered by Task 5 are deleted; session-only tests (`portal-appointment-cancel/reschedule`, `portal-session`) build the app with `ENABLE_SELF_SERVE=true`. Rewrite `portal-abuse` limiter tests for `portal-booking-ip` and `booking-confirm-ip`.
- [ ] **Step 4: Run the whole suites** — `pnpm vitest run --project unit` and `pnpm run test:integration` → all PASS (on a Windows 0xC0000409 worker crash, rerun that file alone). `pnpm exec tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat(portal): remove OTP login, gate self-serve behind ENABLE_SELF_SERVE`

---

### Task 8: Portal — booking flow without login

**Files:**
- Create: `Portal/src/components/PublicBooking/PatientDetailsStep.tsx`, `ProviderContactNotice.tsx`, `Portal/src/api/portal/useBookingConfirmation.ts`
- Modify: `BookingFlow.tsx`, `BookingResult.tsx`, `useBookingFlow.ts`, `src/types/{PublicBooking,PortalBooking}.ts`, `src/config/consentText.ts`
- Delete: `PatientSteps.tsx`, `PortalLogin.tsx`, `useRequestOtp`/`useVerifyOtp`
- Test: `Portal/test/components/PatientDetailsStep.test.tsx`, `useBookingFlow.test.ts`, `PublicBookingPage.test.tsx`

**Interfaces:**
- Consumes: Task 4 API (`POST /providers/:slug/bookings`, `POST /booking-confirmations/release`), Task 7 profile `selfServe`.
- Produces:
  - Types: `BookingContactChoice = { channel: "EMAIL"; email: string } | { channel: "WHATSAPP"; phone: string }`; `StartBookingRequest`; `BookingPending` (mirrors `BookingPendingDto`); `BookingConfirmationView`, `ConfirmationState` (mirrors Task 5); `PublicProvider.selfServe: boolean` (drop `loginChannels`).
  - Hooks (all `usePublicMutation`): `useStartBooking(slug)` → `startBooking(body)`; `useReleaseBooking()` → `release(releaseToken)`; `useConfirmationView()` → `view(token)`; `useConfirmBooking()` → `confirm(token)`.
  - `BookingStep = "need" | "time" | "details"`; `applicableSteps({ typeCount, locationCount })`; `FlowProgress = { needDone; hasSlot }`.
  - `<PatientDetailsStep … onPending(pending: BookingPending) onSlotTaken(message) />`; `<BookingResult provider pending onCorrect />`; `<ProviderContactNotice provider />`.

- [ ] **Step 1: Failing tests**

```tsx
it('asks for name, last name, a confirmation channel (Correo / WhatsApp), the matching contact field, consent and CAPTCHA', ...)
it('shows the optional phone only for the email channel', ...)
it('submits contact + patient + captchaToken and never price, end or status', ...)
it('a 409 slot taken clears the slot and returns to Horario with the server message', ...)
it('WhatsAppUnavailableError switches the choice to Correo and shows the message', ...)
it('the result says the appointment is not confirmed until the link is clicked and names where it went', ...)
it('"¿Te equivocaste? Corregir" releases the hold and returns to details with the slot and form kept', ...)
it('the result shows the provider contact and no "Ver mis citas" when selfServe is false', ...)
it('steps are need/time/details; no verify step', ...) // useBookingFlow.test.ts
```

- [ ] **Step 2: Run, expect FAIL** — `cd Portal && pnpm vitest run test/components/PatientDetailsStep.test.tsx test/components/useBookingFlow.test.ts`
- [ ] **Step 3: Implement.** Copy (exact):
  - Result heading `Revisa tu correo` / `Revisa tu WhatsApp`; body `Tu cita todavía no está confirmada. Te enviamos un enlace a {contact}. Ábrelo y confirma en la próxima hora; si no, el horario quedará libre.` (approval: `Tu solicitud todavía no se ha enviado. …`). Button `¿Te equivocaste? Corregir`.
  - Submit `Reservar cita` / `Enviar solicitud`; busy `Reservando…` / `Enviando…`.
  - `ProviderContactNotice`: `Para cancelar o cambiar tu cita, comunícate directamente con {provider}` + tel:/wa.me links for `phone`/`whatsapp`.
  - `consentText.ts`: replace `accessNotice` with `Al reservar solicitas a ${controllerName(provider)} que utilice este contacto para enviarte el enlace de confirmación de tu cita mediante Patient Nova. No incluyas datos de salud en este paso.` — this bumps the policy version (Task 9 step 3). Mark the new text for counsel review in the PR.
  - Keep the release token in component state only (never the URL or storage).
- [ ] **Step 4: Run, expect PASS**; `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 5: Commit** — `feat(portal-ui): book without a code and wait for the confirmation link`

---

### Task 9: Portal — confirmation page, hidden "Mis citas", policy version

**Files:**
- Create: `Portal/src/app/book/confirmar/[token]/page.tsx`, `Portal/src/components/PublicBooking/BookingConfirmationPage.tsx`
- Modify: `PortalAppointmentsPage.tsx`, `PublicBookingPage.tsx`, `src/utils/publicBooking.ts` (`appointmentsPath` callers), `test/proxy.test.ts`
- Modify: `Server/src/portal/privacy-policy.ts` (`PRIVACY_POLICY_VERSION = '2026-11-09'`), create `docs/legal/versions/2026-11-09/` (copy of the r2 folder with the new access notice)
- Test: `Portal/test/components/BookingConfirmationPage.test.tsx`, `PortalAppointmentsPage.test.tsx`

**Interfaces:**
- Consumes: Task 8 hooks/types, Task 5 view states.
- Produces: page at `/book/confirmar/[token]` inside the `book` layout (light theme, `noindex`); `confirmar` reserved server-side in Task 2.

- [ ] **Step 1: Failing tests**

```tsx
it('loads the view with a POST and does not confirm on load', ...) // fetch mock: only /view called
it('unconfirmed: shows provider, date/time in the patient zone, place, and a "Confirmar mi cita" button', ...)
it('the button POSTs /confirm once (disabled while busy) and shows "Tu cita está confirmada"', ...)
it('approval: shows "Solicitud enviada. {provider} te avisará cuando la confirme."', ...)
it('expired: says the time was released and links to /book/{slug}', ...)
it('unavailable: tells the patient to contact the provider directly', ...)
it('404 shows the shared "no disponible" page', ...)
it('every state shows ProviderContactNotice', ...)
it('Mis citas renders the "no disponible" page when provider.selfServe is false', ...)
it('/book/confirmar is not matched by proxy.ts', ...) // test/proxy.test.ts
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement.** Confirmed copy: `Tu cita está confirmada` + summary + `.ics` download (reuse `downloadAppointmentIcs`) + `ProviderContactNotice`. Expired: `Este enlace venció y el horario quedó libre.` + `Reservar de nuevo`. Unavailable: `No pudimos confirmar tu cita en línea. Comunícate directamente con {provider}.` Remove "Ver mis citas" entry points when `!selfServe`. Bump `PRIVACY_POLICY_VERSION` and add the legal folder.
- [ ] **Step 4: Run, expect PASS** — `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm lint`; `cd Server && pnpm vitest run --project unit` (policy version tests).
- [ ] **Step 5: Commit** — `feat(portal-ui): confirmation page; hide Mis citas without self-serve`

---

### Task 10: E2E, Bruno and docs

**Files:**
- Modify: `Portal/e2e/support/mock-brevo.mjs` (add `/__test/latest-link?to=` returning the newest `/book/confirmar/<token>` URL; drop `latest-code`), `Portal/e2e/support/portal.ts`, `e2e/tests/public/{booking,book,approval,review}.spec.ts`; delete `portal-login.spec.ts`.
- Modify: `AGENTS.md` (Public API/OTP/sessions, Booking, Notifications and frontend sections: replace OTP/session booking with the link flow, `ENABLE_SELF_SERVE`, new caps, new templates, `/book/confirmar`, e2e OTP-budget notes), `docs/operations.md` (templates table: remove OTP row, add the two new Utility templates with variables; limits table renamed to WhatsApp booking caps; "Before phone login" section rewritten for confirmation links), `docs/compliance-patient-data.md` (no login codes; unconfirmed rows purged after 48h), `Bruno Collection/` (remove Portal Auth OTP requests; add Start booking, View/Confirm/Release confirmation).

- [ ] **Step 1: Rewrite specs** — book by email: fill details, choose Correo, submit, read the link from `/__test/latest-link`, open it, assert no confirmation before clicking, click `Confirmar mi cita`, assert confirmed; approval: confirmed → request appears in `openProviderPage` inbox; review: deleted patient → REVIEW request after the click. Assert the WhatsApp choice is offered but book only by email (no Twilio mock).
- [ ] **Step 2: Run** — Playwright public project per AGENTS.md env (`ENABLE_PORTAL=true`, mock-brevo on 4010, CSP enforced build) → PASS. Report honestly if the local environment cannot run it.
- [ ] **Step 3: Docs + Bruno updates** as listed.
- [ ] **Step 4: Commit** — `test(e2e)+docs: booking confirmed by link`

---

## Before production (owner, not code)

- Submit two WhatsApp **Utility** templates in Twilio (Spanish): confirm-link (`{{1}}` provider, `{{2}}` date, `{{3}}` time, URL button `https://<portal>/book/confirmar/{{4}}`) and unconfirmed-expired (`{{1}}`, `{{2}}`, `{{3}}`). Put the SIDs in Railway.
- Set `PORTAL_WHATSAPP_DAILY_CAP=300` and remove the old OTP env vars in Railway.
- Counsel reviews the new access notice and confirms the policy no longer needs to describe login codes.
