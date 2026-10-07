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
- Name search becomes **whole-word**, case- and accent-insensitive ("maria" finds "María José
  Pérez"; "mar" does not). Substring search is no longer possible.
- The database can no longer sort patients by name, last name or email.

**Pilot gate:** section 3 is implemented; a pilot with real patient data still needs the remaining
checklist items in section 5.

## 3. Implementation: encrypted identity/contact fields + blind indexes

**Status: implemented** (migration `20261011000000_encrypt_patient_pii`). Code:
`Server/src/utils/encryption/{encrypted-fields,blind-index,pii-search}.ts`,
`Server/src/utils/prisma/{encryption-extension,backfill-pii}.ts`.

1. **What is encrypted** (AES-256-GCM, `ENCRYPTION_KEY`, random IV): `Patient.name`, `lastName`,
   `email`, `whatsappNumber`, `smsNumber`; `Reminder.to`, `subject` (it can carry the patient's
   name); `MedicalRecord.name`, `birthPlace` (the record's own copy of the patient's identity).
   The columns became `TEXT`; length limits live in the zod schemas.
2. **Keys.** `BLIND_INDEX_KEY` (32 bytes hex, distinct from `ENCRYPTION_KEY`, required in production)
   is kept in the secret manager and backed up separately from database backups. Every blind index
   is `HMAC-SHA256(key, "<purpose>:" + normalizedValue)`, hex, purpose `email`, `phone` or `name`.
   Phone and email hashes are shared across models on purpose: `Reminder.toHash` equals the
   patient's `whatsappHash` for the same number, which is how the WhatsApp webhook finds a reminder.
3. **Index columns, written only by the Prisma extension** from the plaintext on every write that
   sets the source field (so they cannot drift): `Patient.emailHash`, `whatsappHash`, `smsHash`,
   `nameTokens`, `lastNameTokens`; `Reminder.toHash`; `MedicalRecord.nameTokens`. Normalization:
   email trimmed + lower-cased; phone digits only (drops `whatsapp:`, `+`, spaces, punctuation);
   names lower-cased, accents removed (NFD), split on anything that is not a letter or digit.
4. **Uniqueness and matching.** Raw-SQL partial unique index `patients_userId_emailHash_active_key`
   on `("userId", "emailHash") WHERE "isDeleted" = false` (replaces the old expression index).
   `patientRepository.findByEmail` matches by hash.
5. **Search** (`pii-search.ts`): text with `@` = exact email; phone-like text = exact phone (either
   number); anything else = every word must be a whole word of the name or last name, case- and
   accent-insensitive. "maria perez" finds "María José Pérez Gómez"; "mar" finds nothing. Used by
   the patient, appointment and reminder lists (reminders also match the exact destination) and
   the medical-record list (record name). Portal placeholders say "palabras completas" / "exactos".
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
    rest for every field, indexes on create/update/clear, accent/case/whole-word search across the
    four lists, exact email/phone, tenant isolation, sorting + pagination, backfill encryption,
    `updatedAt` preserved, idempotency, uniqueness against backfilled rows).

Residual leakage (documented, accepted): blind indexes are deterministic, so someone who has the
database but not the key can see which rows share a name word, an email or a phone, but not what
they are. Common words ("maria") produce frequent hashes. Anyone with both keys and the database can
read everything; the keys must never be stored with the backups.

## 4. Consent model (0.20 to 0.22)

`PatientConsent(patientId, kind = DATA_PROCESSING, policyVersion, acceptedAt, ip, userAgent, revokedAt?)`

- Immutable rows; revocation sets `revokedAt` and writes an audit entry (`EntityType.PATIENT_CONSENT`).
- Partial unique index `(patientId, kind, policyVersion) WHERE revokedAt IS NULL` makes
  `ensureCurrentConsent` idempotent.
- `policyVersion` = the policy's last-updated date (`2026-10-07` for the current text). Changing the
  privacy policy requires bumping it and re-asking consent at the patient's next booking (7.2).
- Approval-mode requests carry the same evidence on `BookingRequest` and copy it to `PatientConsent`
  on approval, preserving the original acceptance time.
- **Existing patients** (0.21) have no record: they accept at first portal use, before any data
  about them is shown.
- **UI gate (0.22):** one checkbox, never pre-ticked, linking to the policy, whose label states that
  the person authorizes treatment of personal data **including health data** for scheduling and
  reminders. Open question for counsel: whether sensitive data needs its own separate checkbox;
  if yes, add a second one (the data model supports it via `kind`).

## 5. Checklist (owner: controller, with counsel)

- [ ] Controller identity published: legal name, NIT, address, and Colombian representative if needed
      (the controller is currently an individual in Canada; counsel to advise).
- [ ] Decide whether the **RNBD** registration (Registro Nacional de Bases de Datos) applies and file it.
- [ ] Data processing / transmission contracts with each processor (Twilio, Brevo, Google, hosting,
      Sentry if enabled) and a list of them in the policy (done in text; contracts pending).
- [ ] International transfer basis per processor (adequacy list, authorization, or contract).
- [ ] The `privacidad@` mailbox is monitored; internal runbook for the 10/15 business-day deadlines.
- [ ] Incident procedure, including notification to the SIC and affected data subjects.
- [ ] Retention table (clinical records vs. appointments vs. logs) and the erasure path; define how
      the immutable audit log is minimized when a patient is erased.
- [x] Encryption of patient identity/contact fields (section 3) implemented; backfill runs on start.
- [ ] `BLIND_INDEX_KEY` generated, stored in the secret manager and backed up apart from the database.
- [ ] Counsel review of `privacy-policy/page.tsx` and `terms-of-service/page.tsx`.
