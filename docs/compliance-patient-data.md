# Patient data: compliance decision record (Colombia)

Status: **updated 2026-11-06 from `docs/informe-juridico-portal-2026-11-06.md`, which is informative, not a signed opinion.**
This is engineering analysis, not legal advice. Open legal items are in Phase 10 of `PATIENT_PORTAL_PLAN.md`.

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
   is kept in the secret manager and backed up separately from database backups.
   `ENCRYPTION_KEY` works as a keyring: new values are written as `enc:v2:<kid>:...`, where `kid` is
   the first 8 hex characters of SHA-256 of `"patientnova-key-id:"` plus the key bytes. Reads accept
   `enc:v2:` by key id and `enc:v1:` (no id) by trying the current key, then `ENCRYPTION_KEY_PREVIOUS`.
   A key id no configured key matches fails with `Unknown encryption key id`. Every blind index
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
7. **Other readers** read through Prisma and get plaintext from the extension. Raw SQL over these
   columns exists only in the backfill (item 8), `pii:reencrypt` (`reencrypt-pii.ts`, ciphertext only;
   item 9) and the constants `patient:erase` writes (`patient-erasure.service.ts`).
8. **Backfill** (`pnpm run pii:backfill`, runs in `pnpm start` right after `migrate deploy`). Walks
   rows with `piiVersion` null or older than `PII_VERSION`, encrypts plaintext values, writes the
   indexes and stamps `piiVersion`. Raw SQL: `updatedAt` is kept and no audit rows are written.
   Idempotent, resumable, and optimistic (a row the app changed meanwhile is skipped). Without
   `ENCRYPTION_KEY` (local dev) it only writes indexes. Take a `pg_dump` before the first deploy
   that runs it (`docs/operations.md`).
9. **Rotation.** Changing `BLIND_INDEX_KEY` or a normalization rule: bump `PII_VERSION`, deploy;
   the backfill rehashes every row. Searches miss rows that are not rehashed yet, so do it in a
   quiet window. `ENCRYPTION_KEY` rotates with `pnpm run pii:reencrypt`: see "Rotating keys" in
   `docs/operations.md`.
10. **Rollback.** Older code cannot read the ciphertext (it would show `enc:v1:...` strings,
    and `enc:v2:...` once the release that writes `enc:v2:` (10.10 PR B) has run), so rolling back
    the code after the backfill means restoring the pre-deploy dump. Roll forward instead. After the
    keyring release, roll back no further than that release: older code cannot read `enc:v2:`.
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
- `policyVersion` identifies the published package (`2026-11-06-r2` for the current text), archived in
  `docs/legal/versions/`. Changing the policy, the notice or the checkbox requires bumping it, archiving the
  text and re-asking consent at the patient's next booking.
- Approval-mode requests carry the same evidence on `BookingRequest` and copy it to `PatientConsent`
  on approval, preserving the original acceptance time.
- **Existing patients** (0.21) have no record: they accept at first portal use, before any data
  about them is shown.
- **UI gate (0.22):** one checkbox, never pre-ticked, with the text in `Portal/src/config/consentText.ts`. It names
  health data, the purposes and who receives the authorization. Beside it the patient sees the clinic's legal name
  and privacy contact, that the portal is optional, and how to reach the clinic directly. Booking cannot go live
  without those (`legalIdentity` readiness). Consent rows store the version, not the label, so any change to this
  text must bump `PRIVACY_POLICY_VERSION`.

**Revocation procedure.** Revocation is a right under Ley 1581, art. 8, and can be asked for at any time without proving a breach. It works forward: it stops what was withdrawn and never cancels care by itself. It follows section 6, and then:

1. Ask what is being withdrawn: the portal, a channel, or all optional use. Do not treat it as a request to cancel appointments.
2. While an identity is disputed, block the portal and stop messages to the disputed contact, and verify through an independent channel.
3. Run `pnpm run consent:revoke <patientId>` with the production environment. Add `--block-portal` and `--stop-messages` for what was withdrawn.
4. Agree continuity of care and the allowed channel with the clinic, which keeps the clinical record it must keep.
5. Reply to the patient, saying what stopped, what stays and why.

What the command does, in one transaction with audit rows: revokes every active consent; cancels the patient's live booking requests, so the slots are released; with `--block-portal`, closes the portal; with `--stop-messages`, cancels pending reminders and sets `Patient.messagesStoppedAt`, so no route is chosen and the workers cancel anything queued later. Approving a request made before a revocation is refused (409). Running it again changes nothing.

To return: `--restore-portal` and `--restore-messages` reopen what was closed, audited. Consent is never restored by command: the patient authorizes again, and the old revocation stays on record. Without `--block-portal`, the next login asks for a new authorization.

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

- [x] Controller identity published: legal name and address in Colombia. No RUT or NIT applies (owner confirmed 2026-11-06).
- [x] RNBD: the operator, as an individual, is not among the obligated parties. Each clinic checks its own duty. Revisit if the legal structure changes.
- [x] Data processing / transmission contracts with each processor: Twilio, Brevo, Google, Cloudflare,
      Sentry, Railway and Vercel, all named in the policy (treated as approved, owner's decision of 2026-11-06).
- [x] Meta is a recipient of WhatsApp traffic (patient number, provider name, appointment time, place
      or link, and login codes). The policy names Twilio and SMS/WhatsApp "por instrucción de la clínica",
      and, since the draft of 2026-11-06, Meta and phone login: counsel to confirm before the portal reaches production.
- [x] International transfer basis per processor (adequacy list, authorization, or contract).
- [x] The `privacidad@` and `legal@` mailboxes are monitored (owner confirmed 2026-11-06).
- [x] Runbook for the 10/15 business-day deadlines (section 6).
- [x] Incident procedure (section 7): rehearse it once.
- [x] Retention table (section 8): each clinic approves it in its agreement.
- [x] Erasure path built (section 8): rehearse one approved deletion, one export and one restore on staging.
- [x] Encryption of patient identity/contact fields (section 3) implemented; backfill runs on start.
- [x] `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` backed up apart from the database (owner confirmed 2026-11-06).
- [x] Counsel review of `privacy-policy/page.tsx` and `terms-of-service/page.tsx`.

## 6. Data subject requests

Requests arrive at `privacidad@patientnova.net` or through the clinic. Account closure goes to `legal@patientnova.net`.
Patient Nova is the processor for patient data: the clinic decides on the clinical record, and Patient Nova answers
for its own processing, helps carry out the decision and forwards what belongs to the clinic.

| Step | What to do |
|---|---|
| Receive | Log date, type, clinic and deadline, outside the product. Acknowledge within 1 business day (internal target). |
| Identity | Check in proportion to the risk. A reply from the same address is not enough if the contact is disputed. Do not ask for full ID copies by default. Verify representation when someone acts for another person. |
| Classify | Query, correction, deletion, revocation or objection to messages. Ask about scope without making it an obstacle. |
| Transfer | Send the clinic what is theirs within 2 business days, tell the requester, and keep following up. Forwarding does not restart the legal clock. |
| Claim | An incomplete claim is returned for correction within 5 days; after 2 months without a fix it counts as withdrawn. A complete claim is marked "reclamo en trámite" on the affected record within 2 business days. |
| Decide | Name the data, purpose, action and basis for anything kept. If the clinic does not answer, escalate to its authorized contact and answer what is Patient Nova's own. Silence does not allow closing the request. |
| Carry out | Apply and verify in systems and vendors. Sending the order is not enough. |
| Close | Reply plainly, keep minimal evidence with restricted access, and mention the SIC once the process is exhausted. |

A query is answered within 10 business days, extendable by 5. A claim is answered within 15, extendable by 8. Any
extension is explained before the deadline (Ley 1581, arts. 14 and 15).

**Deletion** usually ends in restricted access: clinical records must generally be kept (section 8). When the clinic
approves a real deletion, follow "Erasure" in `docs/operations.md`.

## 7. Security incidents

Juan Manuel Gallego is the operational lead. The backup is Mauricio Gallego, +57 310 555 5961. Keep a security contact for each clinic.

1. Contain: stop the exposure, preserve evidence and record when it was detected.
2. Rotate what was exposed. `AUTH_SECRET`, `PORTAL_AUTH_SECRET`, `BLIND_INDEX_KEY` and `ENCRYPTION_KEY` can
   rotate. For `ENCRYPTION_KEY` follow "Rotating keys" in `docs/operations.md`, and remove the previous
   key right after re-encryption finishes.
3. Assess which clinics, which data subjects, which fields, and for how long.
4. Notify, using one incident record for every notice:

| Who | When |
|---|---|
| Each affected clinic | Without undue delay; proposed contract term of 24 hours from knowledge, even if the investigation is unfinished |
| SIC | Within 15 business days of detection. Registered controllers use the RNBD; unregistered controllers and processors use the SIC incident channel. Check access to it before it is needed |
| Data subjects | Assess harm and sensitivity at once, and notify in time for them to protect themselves. There is no general fixed term |

5. Record the cause, the fix and every notice. Keep names and contact details out of tickets, logs and error tracking.
6. Rehearse this once before launch.

## 8. Retention

| Data | Kept for | How it ends |
|---|---|---|
| Portal OTP rows (hashes) | 24 hours after the last send, needed only for abuse limits | `purge-portal-otps` |
| Portal session | 2 hours | Stateless JWT expires; nothing stored |
| Booking requests | 90 days after they stop being pending, for inbox follow-up. The audit row keeps the event, without contact data | `purge-booking-requests` |
| Scheduler jobs | Dead-letter queues 30 days, other queues pg-boss defaults | pg-boss; payloads carry ids only |
| Clinical record | At least 15 years from the last visit (5 in active archive, 10 in central); longer in the cases Resolución 839 lists. The clinic is the custodian | Clinic decides, with procedure; never automatic |
| Patients, appointments | While the care relationship lasts and for the clinical period when part of the record; soft-deleted rows included | `patient:erase`, when approved |
| Consent records | Same period as the clinical record they support, to prove the processing was authorized; reviewed then | `patient:erase`, when approved |
| Audit log | Same period as the record it evidences; reviewed then. Immutability does not mean forever | Redacted by `patient:erase` |
| Reminders | Same as the appointment | `patient:erase`, when approved |
| Database backups | 30 days, nightly since 2026-11-06 | R2 lifecycle rule; encrypted with `age` |
| Retired `ENCRYPTION_KEY` | After re-encryption, as long as the longest backup retention (30 days in R2, longer if Railway's backups are on), because older backups need it | Deleted from the password manager on the recorded date |
| Vendor copies (Twilio, Meta, Brevo, Sentry, Railway and Vercel logs) | Each vendor's terms and settings | To review with the contracts |

Resolución 1995 de 1999 and its changes, including Resolución 839 de 2017, apply together. These periods are proposals for the
clinic to approve in its agreement, except the clinical minimum.

**Erasure.** `pnpm run patient:erase` removes the patient and every related row, and redacts their audit rows: what they
say is replaced and who, what and when stay. A row is found through the patient's records and portal activity, or by a
mention of their full name or contact anywhere in that provider's log. Audit rows keep names until then: encryption does
not make a name anonymous, but it can always be removed when deletion applies. See "Erasure" in `docs/operations.md`.
