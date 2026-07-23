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
- **Cancel appointment** — `DELETE /appointments/:id` (`CancelAppointmentModal`)
- **View / filter list** — `GET /appointments?...` paginated (`useFetchAppointments`)
- **View stats** — `GET /appointments/stats` (`useFetchAppointmentsStats`)

## Reminders (`/reminders`)
- **Create reminder** — `POST /reminders` (`useCreateReminder`)
- **Edit / reschedule reminder** — `PATCH /reminders/:id` (`EditScheduledReminderModal`, `useUpdateReminder`)
- **Cancel reminder** — `DELETE /reminders/:id` (`CancelReminderModal`)
- **Send reminder now (Notify)** — `POST /notify/whatsapp` and `POST /notify/sms` (`useNotify`)
- **Bulk send** — `BulkSendWizard` (multi-patient notify)
- **View / filter list** — `GET /reminders?...` paginated (`useFetchReminders`)
- **View stats** — `GET /reminders/stats` (`useFetchRemindersStats`)

## Patients (`/patients`)
- **Create patient** — `POST /patients` (`useCreatePatient`)
- **Update patient** — `PATCH /patients/:id` (`useUpdatePatient`)
- **Delete patient** — `DELETE /patients/:id` (`DeletePatientModal`)
- **View list** — `GET /patients` (`useFetchPatients`)
- **View stats** — `GET /patients/stats` (`useFetchPatientsStats`)
- **View patient detail** — `PatientDrawer`

## Medical Records (`/medical-records`)
- **Create medical record** — `POST /medical-records` (`useCreateMedicalRecord`), incl. family members, antecedents, evolution notes, documents
- **Auto-save / update record** — `PATCH /medical-records/:id` (`useUpdateMedicalRecord`)
- **Upload / attach documents** — part of the record payload (`DocumentsSection`)
- **Delete record / document** — `DELETE /medical-records/:id` (`useDeleteMedicalRecord`)
- **Export record as PDF** — `MedicalRecordPDF.downloadMedicalRecordPDF`
- **View records list** — `GET /medical-records` (`useFetchMedicalRecords`)

## Calendar (`/calendar`)
- **View by Day / Week / Month** — read-only visualization of appointments
- **Navigate periods** — prev / next / today
- **Filter by status**

## Settings (`/settings`)
- **Profile tab**
  - Update profile fields (debounced autosave) — `PATCH /users/me` (`useUpdateProfile`)
  - Set timezone
  - Upload profile photo
  - Upload consent document — `POST /consent-document` (`useConsentDocument`)
  - Delete consent document — `DELETE /consent-document`
  - Download consent document — `GET /consent-document/download`
- **Security tab**
  - Change password (`useChangePassword`)
- **Reminders tab**
  - Toggle reminder active, set default channel, WhatsApp/phone numbers — `PATCH /users/me` (`updateProfile`)
- **Locations tab**
  - Create / update / delete locations — `/locations` CRUD (`useCreateLocation`, `useUpdateLocation`, `useDeleteLocation`)
- **Appointment Types tab**
  - Create / update / delete types — `/appointment-types` CRUD (`useCreateAppointmentType`, `useUpdateAppointmentType`, `useDeleteAppointmentType`)

## Dashboard (`/dashboard`)
- **View aggregated stats** — read-only (appointments, patients, reminders)

## Gaps vs Server
The Server exposes additional operations the Portal does **not** yet surface:
- Appointment **restore**
- Reminder **restore / soft-delete**
- Patient **restore / seed**
- **Google virtual-location / Meet** appointment path (requires mocked `google-meet.service` + virtual `appointmentLocation`)

These backend routes exist but have no Portal UI.
