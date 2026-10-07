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
| Patient name, last name | **Plaintext** (searchable) |
| Patient email, whatsapp, sms numbers | **Plaintext** |
| `Reminder.to` (destination email/phone) | **Plaintext** |

## 2. Decision (0.23)

**Encrypt patient contact fields and use blind indexes for the lookups we need. Keep name and last
name in plaintext for now, as a documented residual risk that the controller must accept in writing.**

Rationale:
- Contact fields are the data that lets someone reach a patient; combined with "is a patient of
  provider X" they reveal a health relationship. Encrypting them is cheap because the only lookups
  we need are exact: login-style matching by email and "is this phone already used".
- Names are used for substring search in the provider UI (`contains`, case-insensitive). Encrypting
  them would remove search or force loading all patients into memory. We keep them readable and rely
  on access control, tenant isolation and database-level controls, and revisit if counsel disagrees.
- Residual risk accepted by choosing plaintext names: a database dump exposes names and the
  fact that they are patients of a provider, but not how to contact them or any clinical content.

**Pilot gate (unchanged):** a pilot with real patient data requires the work in section 3 to be
implemented **or** an explicit written acceptance by the controller of the current plaintext state.
Until then use synthetic or staff data only.

## 3. Design: encrypted contacts + blind index

1. **Keys.** New secret `BLIND_INDEX_KEY` (32 bytes, distinct from `ENCRYPTION_KEY`), kept in the
   secret manager and backed up separately from database backups. `emailHash`/`phoneHash` =
   `HMAC-SHA256(key, normalizedValue)`, hex. Store a `hashKeyVersion` smallint to allow rotation
   (rehash job, then bump the active version).
2. **Schema (Patient).** Add `emailHash`, `whatsappHash`, `smsHash` (nullable) and `hashKeyVersion`.
   Widen `email`, `whatsappNumber`, `smsNumber` and `Reminder.to` from `VARCHAR(n)` to `TEXT`
   (ciphertext is longer than the plaintext). Register the fields in `ENCRYPTED_FIELDS`.
3. **Uniqueness and matching.** Replace the raw-SQL index
   `patients_userId_email_normalized_active_key` with a partial unique index on
   `("userId", "emailHash") WHERE "isDeleted" = false`. `patientRepository.findByEmail` (the single
   matching function) hashes the normalized input and queries by hash. Phone duplicates are warned,
   not enforced.
4. **Search.** Provider search keeps substring matching on name/last name. Email/phone search becomes
   exact match through the hash (the UI placeholder text must say so).
5. **Backfill (one-off, idempotent, batched).** `scripts/encrypt-patient-contacts.ts` reads rows whose
   `emailHash IS NULL`, encrypts the three fields (and `Reminder.to`), writes the hashes. The field
   decryptor must accept legacy plaintext until the backfill is complete. Run it as a release step,
   **not** inside `migrate deploy`. Take a `pg_dump` first (see `docs/operations.md`).
6. **Cut-over order.** (a) migration adds columns + widens types; (b) deploy code that writes
   ciphertext + hashes and reads both forms; (c) run backfill; (d) migration creates the hash index
   and drops the plaintext-email index; (e) remove legacy-plaintext tolerance.
7. **Rollback.** Until step (e) the plaintext-tolerant reader makes rollback of the code safe; keep
   the pre-backfill dump until the pilot has been stable for a release.
8. **Tests.** Real-Postgres tests for: ciphertext at rest, equality by hash, case/whitespace
   normalization, per-provider uniqueness, restore conflicts, backfill idempotency, key-version rotation.

Effort: roughly 2 to 3 engineering days plus a staging rehearsal. It must land before patient
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
- [ ] Written acceptance of plaintext names (section 2) **or** a decision to encrypt them.
- [ ] Counsel review of `privacy-policy/page.tsx` and `terms-of-service/page.tsx`.
