# Portal Operations

Complete list of operations a user can perform on the PatientNova Portal
(frontend). Sourced from the API hooks in `src/api` and the pages in
`src/app`. Method + endpoint reflect the underlying Server routes.

## Authentication & Session
- **Login** — `POST /auth/login` (email + password) via `AuthContext.login`
- **Logout** — `POST /auth/logout` via `AuthContext.logout`
- **Auto token refresh** — `POST /auth/refresh` (silent, on 401) via `fetchWithAuth`
- **View own profile** — `GET /users/me` via `AuthContext`

## Appointments (`/appointments`)
- **Create appointment** — `POST /appointments` (`useCreateAppointment`), incl. inline reminder
- **Update appointment** — `PATCH /appointments/:id` (`useUpdateAppointment`)
- **Confirm appointment** — `PATCH /appointments/:id` with `{ status: CONFIRMED }`
- **Mark as paid** — `PATCH /appointments/:id` with `{ paid: true }`
- **Cancel appointment** — `PATCH /appointments/:id` with `{ status: CANCELLED }` (`CancelAppointmentModal`)
- **View / filter list** — `GET /appointments?...` paginated (`useFetchAppointments`)
- **View stats** — `GET /appointments/stats` (`useFetchAppointmentsStats`)
- **View detail** — `AppointmentDrawer`

## Reminders (`/reminders`)
- **Create reminder** — `POST /reminders` (`useCreateReminder`)
- **Edit / reschedule reminder** — `PATCH /reminders/:id` (`EditScheduledReminderModal`, `useUpdateReminder`)
- **Cancel reminder** — `PATCH /reminders/:id` with `{ status: CANCELLED }` (`CancelReminderModal`)
- **Retry failed reminder** — `POST /reminders/:id/retry` (`useRetryReminder`) — History tab + ReminderDrawer
- **Send reminder now (Notify)** — `POST /notify/whatsapp` and `POST /notify/sms` (`useNotify`)
- **Bulk send** — `BulkSendWizard` (multi-patient notify via `POST /notify/bulk`)
- **View / filter list** — `GET /reminders?...` paginated (`useFetchReminders`) — Active and History tabs
- **View stats** — `GET /reminders/stats` (`useFetchRemindersStats`)

## Patients (`/patients`)
- **Create patient** — `POST /patients` (`useCreatePatient`)
- **Update patient** — `PATCH /patients/:id` (`useUpdatePatient`)
- **Delete patient** — `DELETE /patients/:id` (`DeletePatientModal`)
- **View list** — `GET /patients` (`useFetchPatients`)
- **View single patient** — `GET /patients/:id` (`useFetchPatient`) — PatientDrawer, AppointmentModal, ReminderModal
- **Fetch all patients (auto-paginated)** — `useFetchAllPatients` (`GET /patients?pageSize=100&page=N`) — BulkSendWizard
- **View stats** — `GET /patients/stats` (`useFetchPatientsStats`)

## Medical Records (`/medical-records`)
- **Create medical record** — `POST /medical-records` (`useCreateMedicalRecord`), incl. family members, antecedents, evolution notes, documents
- **Auto-save / update record** — `PATCH /medical-records/:id` (`useUpdateMedicalRecord`)
- **Upload / attach documents** — part of the record payload (`DocumentsSection`)
- **Export record as PDF** — `MedicalRecordPDF.downloadMedicalRecordPDF` (client-side generation)
- **View records list** — `GET /medical-records?patientId=...` (`useFetchMedicalRecords`)

## Blocked Time (`/calendar`)
- **Create blocked time** — `POST /blocked-time` (`useCreateBlockedTime`) — BlockedTimeModal
- **Update blocked time** — `PATCH /blocked-time/:id` (`useUpdateBlockedTime`) — BlockedTimeModal
- **Delete blocked time** — `DELETE /blocked-time/:id` (`useDeleteBlockedTime`) — BlockedTimeModal
- **View blocked times** — `GET /blocked-time?...` (`useFetchBlockedTimes`) — Calendar page, AppointmentModal

## Calendar (`/calendar`)
- **View by Day / Week / Month** — visualization of appointments + blocked time
- **Navigate periods** — prev / next / today
- **Create appointment** — `POST /appointments` via AppointmentModal (with prefillDate)
- **Confirm / pay / edit appointment** — `PATCH /appointments/:id`
- **Cancel appointment** — `PATCH /appointments/:id` with `{ status: CANCELLED }`
- **Blocked time CRUD** — see Blocked Time section above

## Settings (`/settings`)
- **Profile tab**
  - Update profile fields (debounced autosave) — `PATCH /users/me` (`useUpdateProfileWithDebounce`)
    - Fields: firstName, lastName, displayName, jobTitle, timezone, avatar, logo, altLogo, bankName, accountNumber, nationalId, bankingKey
  - Set timezone — `PATCH /users/me` (`useUpdateProfile`)
  - Upload profile photo — `PATCH /users/me` (avatar field)
  - Upload consent document — `POST /consent-document` (`useConsentDocument`)
  - Delete consent document — `DELETE /consent-document`
- **Security tab**
  - Change password — `PATCH /auth/change-password` (`useChangePassword`)
- **Reminders tab**
  - Toggle reminder active, set default channel, WhatsApp/phone numbers — `PATCH /users/me` (`useUpdateProfile`)
- **Locations tab**
  - Create / update / delete locations — `/locations` CRUD (`useCreateLocation`, `useUpdateLocation`, `useDeleteLocation`)
  - Reactivate soft-deleted location — `PATCH /locations/:id` with `{ isActive: true }`
- **Appointment Types tab**
  - Create / update / delete types — `/appointment-types` CRUD (`useCreateAppointmentType`, `useUpdateAppointmentType`, `useDeleteAppointmentType`)
  - Reactivate soft-deleted type — `PATCH /appointment-types/:id` with `{ isActive: true }`
- **Audit Logs tab** — `GET /audit-logs?...` paginated with filters (entityType, entityId, actionType, search, dateFrom, dateTo) via `useFetchAuditLogs`

## Dashboard (`/dashboard`)
- **View aggregated stats** — read-only (appointments, patients, reminders)
- **Quick-create appointment** — "Nueva Cita" button opens AppointmentModal
- **Quick-create patient** — "Nuevo Paciente" button opens PatientModal

## Unused API hooks (defined, never used in UI)
These hooks exist in `src/api` but are not imported by any component:
- `useDeleteAppointment` — `DELETE /appointments/:id`
- `useDeleteReminder` — `DELETE /reminders/:id`
- `useDeleteMedicalRecord` — `DELETE /medical-records/:id`
- `useFetchMedicalRecord` — `GET /medical-records/:id` (single record)
- `useConsentDocument.downloadDocument` — `GET /consent-document/download`

## Gaps vs Server
The Server exposes additional operations the Portal does **not** yet surface:
- Appointment **restore**
- Reminder **restore / soft-delete**
- Patient **restore / seed**
- **Google virtual-location / Meet** appointment path (requires mocked `google-meet.service` + virtual `appointmentLocation`)

These backend routes exist but have no Portal UI.
