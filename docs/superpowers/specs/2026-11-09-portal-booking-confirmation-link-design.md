# Portal pilot: booking confirmed by link, no login

Date: 2026-11-09. Status: draft for approval.

## Why

Twilio cannot create the WhatsApp **Authentication** template for login codes (Meta error 10/2388185: the
business account is not yet allowed to create Authentication templates). Beyond that, the code step is friction
the pilot does not need. The owner decided:

- Remove the OTP login entirely.
- Defer "Mis citas" (list, cancel, reschedule) completely for the pilot.
- Prove the contact by a **confirmation link** sent after booking. The patient chooses whether it goes by
  **email or WhatsApp**.
- Once booked, patients change or cancel by contacting the provider directly, using the contact details the
  provider published.

Success: a patient books in one pass (time → details → "Reservar"), gets one message, clicks once, and is
booked. Nothing touches a patient record until that click.

## Goals

1. Booking needs no code and no session. The booking request is anonymous, protected by CAPTCHA and the
   existing limits.
2. Pressing "Reservar" holds the slot for **1 hour** (or until the start, if sooner) as an **unconfirmed**
   booking, and sends a confirmation link to the contact the patient chose (email or WhatsApp).
3. The success screen and the message say explicitly that the appointment is **not confirmed until the
   patient clicks the link**.
4. Clicking the link is the proof of the contact, the same proof a verified OTP gave before. Confirming then
   follows today's booking rules unchanged:
   - Auto-confirm: patient resolution (`resolvePortalPatient` with the proven contact, including review
     routing), cap, consent and appointment creation, then today's notifications.
   - Approval mode: becomes a normal PENDING request in the provider inbox, with today's hold length
     (`min(now + 48h, startAt)`) and today's `received` notices.
5. Not clicked within the hour: the slot is released (by clock, like every hold) and the patient gets an
   "expired" message on the same channel saying the time was not reserved.
6. The confirmed page, and every patient email about a portal appointment or request, tell the patient to
   contact the provider directly to cancel or change it, showing the provider's public phone and/or WhatsApp
   (`publicPhone`, `publicWhatsapp`; booking readiness already requires one of them).
7. A new flag `ENABLE_SELF_SERVE` (default off) gates everything deferred: "Mis citas", patient cancel,
   patient reschedule, request cancel, and their session routes. Off means hidden in the UI and the routes
   are not mounted (404).
8. OTP is removed: routes, service, repository, worker, the `PortalOtp` table, the login UI, and
   `TWILIO_WHATSAPP_PATIENT_PORTAL_OTP_SID`.

## Non-goals

- Any way into "Mis citas" (link-based sessions, "send me my link"). That is a later project behind
  `ENABLE_SELF_SERVE`.
- SMS. Confirmation goes by email or WhatsApp only.
- Changes to how the provider creates or manages appointments, or to the provider inbox beyond what
  goal 4 needs.

## Anti-goals (fail even if it works)

- **Confirming on GET.** Email security scanners and link previews open links automatically. Opening the
  link must show a page with a "Confirmar mi cita" button; only the button's POST confirms.
- **Touching patient data before the click.** No patient lookup, creation, consent row or appointment for
  an unconfirmed booking. A stranger typing someone else's email or number creates at most a hold that
  expires, plus one confirmation and one expiry message.
- **Revealing existence.** The booking response and success screen are identical whether or not the contact
  belongs to a patient. Existing patient-resolution outcomes surface only after confirmation, as today.
- **Notifying the provider about unconfirmed bookings.** The provider learns about a booking only once it
  is confirmed. Unconfirmed holds block slots but do not appear in the inbox or the count.
- **A WhatsApp template that reads as identity verification.** It must read as an appointment confirmation
  ("Tienes una cita pendiente con {{1}} el {{2}} a las {{3}}. Confírmala aquí", with a URL button), so it can
  be a **Utility** template.
- **Tokens leaking.** The confirmation token is random, single-use and stored only as a hash. It must never
  be logged (see `loggedPath`), sent to Sentry, or stored in plaintext.

## Constraints from the codebase (AGENTS.md still applies)

- Writes run under `withProviderLock` first; holds use `bookingRequestService.createHoldWithin` and the
  `booking_requests_no_hold_overlap` exclusion constraint (it must also cover unconfirmed holds, which
  block slots like any live hold).
- Public endpoints that send messages or create records use `requireCaptcha(createCaptchaVerifier(),
  '<action>')`, mounted through `createPublicApiRouter()` with the 10kb body limit. The confirm endpoint
  takes no CAPTCHA (the token is the proof, as OTP verify was) but is rate limited.
- WhatsApp sends from an anonymous request cost money. The paid caps protecting OTP carry over to
  confirmation messages: 3 per number per hour, `perProviderPaidPerHour` 30 numbers, and the daily cap
  (`PORTAL_OTP_PAID_DAILY_CAP`, to be renamed), counted transactionally on records (not only HTTP limits).
  A hit cap answers the usual response and logs at error level without PII, as today.
- Caps: per-contact (3 live) counts unconfirmed and pending together, by contact hash; per-provider is split
  into 5 live unconfirmed and the existing 50 live pending (see "Decided by the owner").
- Booking request fields stay encrypted with blind indexes. The contact the patient chose is unproven until
  the click; on confirmation it becomes the proven contact (`email` / `verifiedPhone`). Any other typed phone
  remains `phone` (typed, never queried), and a new patient created from an email confirmation keeps
  `whatsappUnverified` semantics.
- Consent is shown at booking and stored on the request (`consentAcceptedAt`, IP, user agent);
  `ensureCurrentConsent(..., request.consentAcceptedAt)` runs at confirmation, as approval already does.
- Audit: required `BOOKING_REQUEST` audit inside the transaction for creation, confirmation and expiry, never
  carrying request PII. Portal actor ids come only from `portalActorId`.
- Patient messages go through `renderPatientNotice` / the existing email templates, with the patient's
  timezone, no full stop after "a. m."/"p. m.", and no empty WhatsApp variable.
- New `EntityType`/`ActionType` values (if any) get labels in `Portal/src/types/AuditLog.ts`.
- Public pages keep their rules: outside `(provider)`, light theme, `noindex`, `publicApi` for anonymous
  calls, Spanish copy.

## Decided by the owner

- Patient chooses email or WhatsApp for the confirmation link.
- Unconfirmed hold: 1 hour.
- Expiry message to the patient when the link expires.
- No "Mis citas" in the pilot; patients contact the provider directly.
- `ENABLE_SELF_SERVE` flag for the deferred features.
- OTP removed.
- **Deliberate slot-blocking:** unconfirmed holds get their own small cap, **5 live per provider**, separate
  from (and not counted in) the 50 live requests per provider. An attacker rotating fake emails can block at
  most 5 slots for an hour; confirmed requests always have room. The per-contact cap (3 live) still counts
  unconfirmed and pending together. A hit unconfirmed cap answers a neutral "no hay cupo ahora, intenta en un
  rato" (it reveals nothing about any patient).
- **Mistyped contact:** the success screen shows the email or number the link went to, with
  "¿Te equivocaste? Corregir". It releases the unconfirmed hold and returns to the details step with the same
  slot selected. Only the browser that booked can do this: the booking response returns a separate random
  release secret (stored only as a hash on the request, held in component state, never in the URL), and the
  release endpoint accepts it only while the request is unconfirmed. Releasing sends no expiry message.

## Calls made by Claude (check these)

1. The link opens a confirmation page; a button POST confirms (anti-scanner).
2. Approval mode: after the click the request enters the inbox exactly as today.
3. Unconfirmed bookings are invisible to the provider (no inbox entry, no notice).
4. `ENABLE_SELF_SERVE` off = UI hidden and routes unmounted (404). The portal session code stays in the
   repo for the future project; only OTP is deleted.
5. The `PortalOtp` table is dropped by migration (its rows are login-code hashes purged after 24 hours).
6. "Contact the provider" text goes in emails and on the confirmed page. Existing WhatsApp notice templates
   keep their approved text in the pilot; only the new confirmation template is added.
7. The confirmation link's hold is `min(now + 1h, startAt)`; a slot starting in less than an hour still
   gets the remaining time.
8. **WhatsApp paid cap hit:** checked before the hold. No hold is created and the patient is told WhatsApp is
   not available right now and to use email. This bends the "same response" rule, but the cap is about the
   number's sending volume, not patient existence, so it reveals nothing about any patient.
9. **Expiry on WhatsApp** uses a new Utility template (new env var
   `TWILIO_WHATSAPP_PATIENT_PORTAL_BOOKING_UNCONFIRMED_SID`, wording along the lines of "Tu reserva con {{1}}
   el {{2}} a las {{3}} no se confirmó y el horario quedó libre"), because the existing request-expired text
   means "the provider did not answer". Confirmation is a second new Utility template (its own env var).
   Expiry sends count toward the paid caps, and expiry is skipped when the confirmation was never sent.
   Email expiry uses a new email template, not the request-expired one.
10. **Approval mode, after the click:** no separate patient receipt (`sendRequestReceipt` is not sent for
    these requests). The confirmation page says the request was sent and the provider will answer; the
    patient then gets today's approved/rejected/expired notices. Any existing patient email linking to
    `/appointments` drops that link while `ENABLE_SELF_SERVE` is off.
11. **Reminders keep their current text** in the pilot. "Contact the provider to change or cancel" goes in
    the portal booking and request emails and on the confirmation page only.

## Left to the builder

- Data model for "unconfirmed": a new `BookingRequestStatus` value or a field on `BookingRequest`, the token
  hash column, and how the effective-status logic (PENDING past `holdExpiresAt` = EXPIRED) extends to it.
- URL shape of the link and how the token reaches the API without being logged.
- Response shape of the booking and confirm endpoints, and their Spanish error mapping (taken slot,
  expired or used link, caps).
- Confirm-twice behavior (second click on a confirmed link shows the confirmed state, not an error).
- The `ENABLE_SELF_SERVE` plumbing (server config, how the Portal learns it, e.g. a field in the public
  provider profile) and test coverage for both states.
- Updating AGENTS.md, `docs/operations.md`, Bruno requests, `.env.*`/CI env, and the e2e specs (read the
  link from `mock-brevo`; no OTP requests).
