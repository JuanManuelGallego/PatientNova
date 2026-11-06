# Patient data: compliance decision record (Colombia)

Status: **proposed, needs controller sign-off and review by Colombian counsel.** Items 0.20 to 0.23
of `PATIENT_PORTAL_PLAN.md`. This is engineering analysis, not legal advice.

Applicable framework: Ley 1581 de 2012, Decreto 1377 de 2013 (compiled in Decreto 1074 de 2015),
SIC guidance, and for clinical records Resolución 1995 de 1999. Health data is **sensitive data**
(Ley 1581, art. 5): explicit, informed, prior authorization is required and cannot be a condition
for the service.

## 1. What is protected today

| Data | At rest |
|---|---|
| Clinical content (medical records, family members, evolution notes) | Encrypted (AES-256-GCM, app level) |
| Patient / appointment notes, reminder bodies, audit descriptions and diffs | Encrypted |
| Provider banking and national id | Encrypted |
| Patient name, last name, email, whatsapp, sms numbers | Encrypted, searchable through blind indexes (section 3) |
| `Reminder.to` and `subject`, medical record name and birth place | Encrypted |

## 2. Decision (0.23)

**Encrypt all patient identifying and contact fields: `name`, `lastName`, `email`, `whatsappNumber`,
`smsNumber` and `Reminder.to`. Keyed blind indexes (HMAC) provide the lookups we need.** (Decided by
the user on 2026-10-06; supersedes an earlier draft that kept names in plaintext.)

Rationale:
- Name and last name are personal data that identify the patient; combined with "is a patient of
  provider X" (a psychologist) they reveal a health relationship, i.e. sensitive data under
  Ley 1581 art. 5. A database dump or backup leak must not expose who the patients are.
- Contact fields let someone reach the patient; same reasoning.

Accepted functional cost (see section 3, items 4 and 5):
- Name search matches **word prefixes of 3+ letters**, case- and accent-insensitive ("mar" finds
  "María José Pérez"; "erez" does not). Substring search is no longer possible.
- The database can no longer sort patients by name, last name or email (done after decryption).

**Pilot gate:** section 3 is implemented; a pilot with real patient data still needs the remaining
checklist items in section 5.

## 3. Implementation: encrypted identity/contact fields + blind indexes

**Status: implemented** (migration `20261019000000_encrypt_patient_pii`). Code:
`Server/src/utils/encryption/{encrypted-fields,blind-index,pii-search}.ts`,
`Server/src/utils/prisma/{encryption-extension,backfill-pii}.ts`.

1. **What is encrypted** (AES-256-GCM, `ENCRYPTION_KEY`, random IV): `Patient.name`, `lastName`,
   `email`, `whatsappNumber`, `smsNumber`; `Reminder.to`, `subject` (it can carry the patient's
   name); `MedicalRecord.name`, `birthPlace` (the record's own copy of the patient's identity);
   `BookingRequest.email`, `verifiedPhone`, `name`, `lastName`, `phone`.
   The columns became `TEXT`; length limits live in the zod schemas.
2. **Keys.** `BLIND_INDEX_KEY` (32 bytes hex, distinct from `ENCRYPTION_KEY`, required in production)
   is kept in the secret manager and backed up separately from database backups. Every blind index
   is `HMAC-SHA256(key, "<purpose>:" + normalizedValue)`, hex, purpose `email`, `phone` or `name`.
   Phone and email hashes are shared across models on purpose: `Reminder.toHash` equals the
   patient's `whatsappHash` for the same number, which is how the WhatsApp webhook finds a reminder.
3. **Index columns, written only by the Prisma extension** from the plaintext on every write that
   sets the source field (so they cannot drift): `Patient.emailHash`, `whatsappHash`, `smsHash`,
   `nameTokens`, `lastNameTokens`; `Reminder.toHash`; `MedicalRecord.nameTokens`;
   `BookingRequest.emailHash`, `verifiedPhoneHash`. Normalization:
   email trimmed + lower-cased; phone digits only (drops `whatsapp:`, `+`, spaces, punctuation);
   names lower-cased, accents removed (NFD), split on anything that is not a letter or digit.
4. **Uniqueness and matching.** Raw-SQL partial unique index `patients_userId_emailHash_active_key`
   on `("userId", "emailHash") WHERE "isDeleted" = false` (replaces the old expression index).
   `patientRepository.findByEmail` matches by hash.
5. **Search** (`pii-search.ts`): text with `@` = exact email; phone-like text = exact phone (either
   number); anything else = every search word must start a word of the name or last name, case-
   and accent-insensitive. Each stored word is indexed whole plus its prefixes of 3 to 20 letters
   ("maria" -> mar, mari, maria), so "mar per" finds "María José Pérez"; query words under 3
   letters only match an identical word ("de" finds "de la Torre", "ma" finds nothing); substrings
   ("erez") never match. Used by the patient, appointment and reminder lists (reminders also match
   the exact destination) and the medical-record list (record name). Portal placeholders say email
   and phone must be exact. (`PII_VERSION` 2 added the prefixes; the backfill rehashed v1 rows.)
6. **Sorting.** The patient list still sorts by name, last name or email: matching rows (at most
   5,000, `IN_MEMORY_SORT_CAP`) are decrypted and sorted with a Spanish collator, then paginated;
   above the cap it falls back to newest first and logs a warning. Patients without email sort last.
7. **Other readers** read through Prisma and get plaintext from the extension; there is no raw SQL
   over these columns besides the backfill.
8. **Backfill** (`pnpm run pii:backfill`, runs in `pnpm start` right after `migrate deploy`). Walks
   rows with `piiVersion` null or older than `PII_VERSION`, encrypts plaintext values, writes the
   indexes and stamps `piiVersion`. Raw SQL: `updatedAt` is kept and no audit rows are written.
   Idempotent, resumable, and optimistic (a row the app changed meanwhile is skipped). Without
   `ENCRYPTION_KEY` (local dev) it only writes indexes. Take a `pg_dump` before the first deploy
   that runs it (`docs/operations.md`).
9. **Rotation.** Changing `BLIND_INDEX_KEY` or a normalization rule: bump `PII_VERSION`, deploy;
   the backfill rehashes every row. Searches miss rows that are not rehashed yet, so do it in a
   quiet window.
10. **Rollback.** Older code cannot read the ciphertext (it would show `enc:v1:...` strings), so
    rolling back the code after the backfill means restoring the pre-deploy dump. Roll forward instead.
11. **Tests:** `test/integration/patients/patient.pii-encryption.integration.test.ts` (ciphertext at
    rest for every field, indexes on create/update/clear, accent/case/prefix search across the
    four lists, exact email/phone, tenant isolation, sorting + pagination, backfill encryption,
    `updatedAt` preserved, idempotency, uniqueness against backfilled rows).

Residual leakage (documented, accepted): blind indexes are deterministic, so someone who has the
database but not the key can see which rows share a name word, a name prefix, an email or a phone,
but not what they are. The number of name tokens reveals the approximate length of each name word,
and frequent prefixes ("mar") are easier to guess by frequency than whole words. Anyone with both keys and the database can
read everything; the keys must never be stored with the backups.

## 4. Consent model (0.20 to 0.22)

`PatientConsent(patientId, kind = DATA_PROCESSING, policyVersion, acceptedAt, ip, userAgent, revokedAt?)`

- Rows are never deleted. The product has no revocation feature: an operator sets `revokedAt` and
  writes the audit entry (`EntityType.PATIENT_CONSENT`) with `pnpm run consent:revoke` (see
  "Revocation procedure" below).
- Partial unique index `(patientId, kind, policyVersion) WHERE revokedAt IS NULL` makes
  `ensureCurrentConsent` idempotent.
- `policyVersion` = the policy's last-updated date (`2026-11-06` for the current text). Changing the
  privacy policy requires bumping it and re-asking consent at the patient's next booking.
- Approval-mode requests carry the same evidence on `BookingRequest` and copy it to `PatientConsent`
  on approval, preserving the original acceptance time.
- **Existing patients** (0.21) have no record: they accept at first portal use, before any data
  about them is shown.
- **UI gate (0.22):** one checkbox, never pre-ticked, linking to the policy. The label today reads
  "Acepto el tratamiento de mis datos personales según la Política de privacidad" and does **not**
  mention health data. Changing it waits on counsel, who also decides whether sensitive data needs
  its own separate checkbox (the data model supports a second one via `kind`). Consent rows store
  the policy version, not the label, so any label change must bump `PRIVACY_POLICY_VERSION`.

**Revocation procedure (draft, pending counsel).** Revocation is a right under Ley 1581, art. 8, and
the policy offers it through `privacidad@patientnova.net`.

1. Log the request and the date received. A query has 10 business days and a claim 15, extendable by
   5 and 8.
2. Verify identity: the requester replies from the contact on file, or the clinic confirms it.
3. Forward the request to the clinic, which is the controller, and tell the patient it was forwarded.
4. The clinic cancels upcoming appointments, which also cancels their reminders, and rejects any
   pending booking request. It decides what clinical data must be kept.
5. The operator runs `pnpm run consent:revoke <patientId>` with the production environment. Add
   `--block-portal` only if the patient also wants off the portal.
6. Reply to the patient and close the log entry.

What the command does and does not do:
- It revokes every active consent of the patient and writes one audit row each, in one transaction.
  Running it again changes nothing.
- Consent gates only the portal. The command stops no reminders or notices and cancels nothing, which
  is why step 4 comes first. Deleting a patient does not cancel appointments either.
- Approving a request made before the revocation copies its consent back, so step 4 must reject it.
- Without `--block-portal`, the next login asks for consent again, and accepting is a new authorization.
  Anyone holding a shared contact could accept: an open question for counsel.
- With `--block-portal`, the patient reaches the portal's "unavailable" path. No screen undoes this:
  it takes a direct database change, which the audit log will not record.

**Phone login and messages.** A number is personal data the patient proves with a code before it
acts as an identity. `BookingRequest.verifiedPhone` keeps the proven number of a request (encrypted,
with a blind index) and is deleted with the request after 90 days. A number typed in the booking form
is flagged `Patient.whatsappUnverified`: it receives no automated portal message and is not accepted at
login until the provider endorses it. A provider can still choose it by hand for a reminder. SMS is not
end-to-end encrypted and both phone channels show on lock screens, so portal notices and portal SMS
reminders carry only the provider, the time and the place or link, never the appointment type, notes or
the patient's name.

**Exception to review:** WhatsApp reminders reuse the existing approved template, which greets the patient
by name and includes the address and instructions. Removing the name needs a new template.

## 5. Checklist (owner: controller, with counsel)

- [ ] Controller identity published: legal name, NIT, address, and Colombian representative if needed
      (the controller is currently an individual in Canada; counsel to advise).
- [ ] Decide whether the **RNBD** registration (Registro Nacional de Bases de Datos) applies and file it.
- [ ] Data processing / transmission contracts with each processor: Twilio, Brevo, Google, Cloudflare,
      Sentry, Railway and Vercel, all named in the policy (contracts pending; for Sentry, review and
      accept its DPA in the organization's legal settings).
- [ ] Meta is a recipient of WhatsApp traffic (patient number, provider name, appointment time, place
      or link, and login codes). The policy names Twilio and SMS/WhatsApp "por instrucción de la clínica",
      and, since the draft of 2026-11-06, Meta and phone login: counsel to confirm before the portal reaches production.
- [ ] International transfer basis per processor (adequacy list, authorization, or contract).
- [ ] The `privacidad@` and `legal@` mailboxes are monitored, confirmed by a test from an outside account.
- [ ] Runbook for the 10/15 business-day deadlines: drafted in section 6, counsel to confirm.
- [ ] Incident procedure, including notification to the SIC and affected data subjects: drafted in
      section 7, counsel to confirm.
- [ ] Retention table: drafted in section 8, counsel to confirm.
- [ ] Erasure path, including how the immutable audit log is minimized when a patient is erased:
      not built, waits on counsel (section 8).
- [x] Encryption of patient identity/contact fields (section 3) implemented; backfill runs on start.
- [x] `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` backed up apart from the database (owner confirmed 2026-11-06).
- [ ] Counsel review of `privacy-policy/page.tsx` and `terms-of-service/page.tsx`.

## 6. Data subject requests (draft, pending counsel)

Requests arrive at `privacidad@patientnova.net`. Account closure goes to `legal@patientnova.net`.
Patient Nova is the processor for patient data, so the clinic decides those requests.

1. Log the date received, the type (query or claim), and the deadline. Keep the log outside the
   product, and keep it to what the deadline needs.
2. Verify identity: the requester replies from the contact on file, or the clinic confirms it.
3. If it concerns a patient, forward it to the clinic within 2 business days and tell the requester.
   If it concerns a provider account, Patient Nova answers it directly.
4. A query is answered within 10 business days, extendable by 5. A claim is answered within 15,
   extendable by 8. Any extension is explained to the requester before the deadline.
5. Follow up with the clinic so the deadline is met. Consent revocation follows section 4.
6. Reply in writing and close the log entry.

Counsel to confirm the 2-day transfer, how incomplete claims are handled, and who answers when a
clinic does not respond.

## 7. Security incidents (draft, pending counsel)

1. Contain: stop the exposure and record the time it was detected.
2. Rotate what was exposed. `AUTH_SECRET`, `PORTAL_AUTH_SECRET` and `BLIND_INDEX_KEY` can rotate today.
   **`ENCRYPTION_KEY` cannot until 10.10 is built**: a leaked key cannot be replaced.
3. Assess which clinics, which data subjects, which fields, and for how long. Ciphertext without keys
   and blind indexes without keys count as a smaller exposure than plaintext.
4. Notify each affected clinic, which is the controller for its patients.
5. Notify the SIC and the affected data subjects. Counsel to confirm the deadline, the channel, and
   who files for patient data: Patient Nova or the clinic.
6. Record the cause, the fix and every notice sent. Keep names and contact details out of tickets,
   logs and error tracking.

## 8. Retention (draft, pending counsel)

| Data | Kept for | How it ends |
|---|---|---|
| Portal OTP rows | 24 hours after the last send | `purge-portal-otps` |
| Portal session | 2 hours | Stateless JWT expires; nothing stored |
| Booking requests | 90 days after they stop being pending | `purge-booking-requests` |
| Scheduler jobs | Dead-letter queues 30 days, other queues pg-boss defaults | pg-boss; payloads carry ids only |
| Patients, appointments, medical records | Indefinitely, including soft-deleted rows | No purge exists |
| Consent records | Indefinitely | No purge exists; they are evidence |
| Audit log | Indefinitely | Immutable through the Prisma guard |
| Reminders | Indefinitely | No purge exists |
| Database backups | 30 days, nightly since 2026-11-06 | R2 lifecycle rule; encrypted with `age` |
| Vendor copies (Twilio, Meta, Brevo, Sentry, Railway and Vercel logs) | Each vendor's terms and settings | To review with the contracts |

Clinical retention depends on the clinic and on health regulation. The policy cites Resolución 839
de 2017 and this document cites Resolución 1995 de 1999: counsel to confirm which applies and the term.

**Erasure gap.** The product can only soft-delete a patient, and section 7 of the policy promises no fixed
deletion term. A real erasure is blocked by `PatientConsent` (`onDelete: Restrict`), and deleting a
patient writes the full name into an immutable audit description (encrypted at rest,
`patient.service.ts`). Build nothing until counsel says what must be erased and what must be kept.
