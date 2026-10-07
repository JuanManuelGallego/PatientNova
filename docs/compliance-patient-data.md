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
| Patient name, last name | **Plaintext** (substring-searchable, sortable) |
| Patient email, whatsapp, sms numbers | **Plaintext** |
| `Reminder.to` (destination email/phone) | **Plaintext** |

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

**Pilot gate:** a pilot with real patient data requires section 3 to be implemented. Until then use
synthetic or staff data only.

## 3. Design: encrypted identity/contact fields + blind indexes

1. **Keys.** New secret `BLIND_INDEX_KEY` (32 bytes, distinct from `ENCRYPTION_KEY`), kept in the
   secret manager and backed up separately from database backups. Every blind index is
   `HMAC-SHA256(key, "<purpose>:" + normalizedValue)`, hex; the purpose prefix (`email`, `phone`,
   `name`) keeps equal values in different fields from producing equal hashes. Store a
   `hashKeyVersion` smallint to allow rotation (rehash job, then bump the active version).
2. **Schema (Patient).** Add `emailHash`, `whatsappHash`, `smsHash` (nullable), `nameTokens`
   (`TEXT[]`, GIN index) and `hashKeyVersion`. Widen `name`, `lastName`, `email`, `whatsappNumber`,
   `smsNumber` and `Reminder.to` from `VARCHAR(n)` to `TEXT` (ciphertext is longer than the plaintext).
   Register the fields in `ENCRYPTED_FIELDS`. Length limits move from the column to the zod schemas.
3. **Uniqueness and matching.** Replace the raw-SQL index
   `patients_userId_email_normalized_active_key` with a partial unique index on
   `("userId", "emailHash") WHERE "isDeleted" = false`. `patientRepository.findByEmail` (the single
   matching function) hashes the normalized input and queries by hash. Phone duplicates are warned,
   not enforced.
4. **Search.** One search box, three cases:
   - *Name:* the stored `name` and `lastName` are normalized (lowercase, accents removed with NFD,
     punctuation to spaces), split into words, and each word is hashed into `nameTokens`. A query is
     normalized and tokenized the same way and matches when **all** its words are present
     (`"nameTokens" @> ARRAY[...]`). So "maria perez" finds "María José Pérez Gómez"; partial words
     do not match.
   - *Email / phone:* exact match through the hash.
   - Applies to the three places that search by patient name today: patient list
     (`patient.repository.ts`), appointment list (`appointment.repository.ts`) and reminder list
     (`reminder.repository.ts`, which also searches `Reminder.to` by substring; that becomes exact).
   - The UI placeholder text must say "nombre completo, correo o teléfono exactos".
5. **Sorting.** Remove `name`, `lastName` and `email` from the patient list `orderBy` options
   (`patient.schemas.ts`); keep `createdAt`/`updatedAt`. Alphabetical order, where the UI needs it,
   is done after decryption on the returned page only.
6. **Other readers.** Everything that reads names through Prisma (reminder rendering, daily reminder
   worker, status notifications, audit descriptions) gets plaintext from the encryption extension
   and needs no change. Raw SQL that reads these columns must be checked during implementation.
7. **Backfill (one-off, idempotent, batched).** `scripts/encrypt-patient-pii.ts` reads rows whose
   `hashKeyVersion IS NULL`, encrypts the five patient fields (and `Reminder.to`), writes the hashes
   and name tokens. The field decryptor must accept legacy plaintext until the backfill is complete.
   Run it as a release step, **not** inside `migrate deploy`. Take a `pg_dump` first (see
   `docs/operations.md`).
8. **Cut-over order.** (a) migration adds columns + widens types; (b) deploy code that writes
   ciphertext + hashes and reads both forms, with search using the tokens; (c) run backfill;
   (d) migration creates the hash index and drops the plaintext-email index; (e) remove
   legacy-plaintext tolerance.
9. **Rollback.** Until step (e) the plaintext-tolerant reader makes rollback of the code safe; keep
   the pre-backfill dump until the pilot has been stable for a release.
10. **Tests.** Real-Postgres tests for: ciphertext at rest for every field, equality by hash,
    case/whitespace/accent normalization, all-words name search, per-provider uniqueness, restore
    conflicts, removed sort options rejected, backfill idempotency, key-version rotation.

Residual leakage (documented, accepted): blind indexes are deterministic, so someone who has the
database but not the key can see which rows share a name word or an email, but not what it is.
Common words ("maria") produce frequent hashes.

Effort: roughly 3 to 4 engineering days plus a staging rehearsal. It must land before patient
matching (3.3) is released, because matching is implemented on the hash.

## 4. Consent model (0.20 to 0.22)

`PatientConsent(patientId, kind = DATA_PROCESSING, policyVersion, acceptedAt, ip, userAgent, revokedAt?)`

- Immutable rows; revocation sets `revokedAt` and writes an audit entry (`EntityType.PATIENT_CONSENT`).
- Partial unique index `(patientId, kind, policyVersion) WHERE revokedAt IS NULL` makes
  `ensureCurrentConsent` idempotent.
- `policyVersion` = the policy's last-updated date (`2026-10-06` for the current text). Changing the
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
- [ ] Encryption of patient identity/contact fields (section 3) implemented and backfilled.
- [ ] Counsel review of `privacy-policy/page.tsx` and `terms-of-service/page.tsx`.
