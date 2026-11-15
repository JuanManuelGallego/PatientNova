# Portal UI Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the 2026-11-15 Portal UI/UX review (localhost:3000, 1280×598 viewport).

**Architecture:** Mostly Portal-only changes (components, `src/app/globals.css`, copy). Two small Server changes: bounded reminder "este mes" stats and a proper login audit row. Each task is independent and ships on its own.

**Tech Stack:** Next.js (read `Portal/node_modules/next/dist/docs/` before touching routing), React, Vitest + Testing Library (`Portal/test/`), Playwright (`Portal/e2e/`, `chromium` project = Desktop Chrome 1280×720), Server Vitest unit/integration.

**Spec:** The review report in the 2026-11-15 session. Findings are restated in each task.

## Global Constraints

- Copy is Spanish, **sentence case** for titles, buttons, labels, pills ("Nueva cita", not "Nueva Cita"); keep proper nouns.
- Display times use the existing 12h `a. m./p. m.` formatters in `src/utils/TimeUtils.ts`; never add a full stop after them.
- Money: `$ 150.000` (es-CO grouping, space after `$`). One helper, used everywhere.
- Weeks start on Monday everywhere (provider and public).
- Colors only through tokens defined in BOTH `[data-theme="light"]` and `[data-theme="dark"]` in `globals.css`; no hex fallbacks in `var()`.
- Run only affected test files locally; full suites go to CI (user preference).
- New Server `ActionType` values get Portal labels in `Portal/src/types/AuditLog.ts` in the same PR (AGENTS.md).
- After `schema.prisma` changes: inspect the generated migration SQL, remove any generated `DROP INDEX`/`DROP CONSTRAINT` for the raw-SQL objects listed in AGENTS.md, then `pnpm exec prisma generate`.

## Review Focus

- Typing fast + Enter in any patient picker (medical records, appointment modal, reminder modal) must select the patient matching the typed text, never the previous list's first row.
- At 1280×720 every list page shows status, payment and row actions without horizontal scrolling.
- A failed fetch must never render "0" stats or "no data yet" empty states.
- A provider whose notice channel has no address must see that before notices silently stop.
- Dark theme screens (calendar, Envío masivo, error pages) must not show light-theme surfaces.

---

### Task 1: Patient picker selects stale result on Enter (P1)

**Files:**
- Modify: `Portal/src/components/PatientAutocomplete.tsx` (`handleKeyDown`, `filters`)
- Test: `Portal/test/components/PatientAutocomplete.test.tsx`

- [ ] **Step 1: Failing test** `it("does not select a stale result when Enter is pressed before the search settles")`: mock `useFetchPatients` to return `[Santiago, Mariana]` for search `""` and `[Valentina]` for `"Valen"`; type `Valen`, press Enter immediately (fake timers, before 250ms); assert `onChange` not called. Advance timers, press Enter; assert `onChange` called with Valentina's id.
- [ ] **Step 2:** Run `pnpm vitest run test/components/PatientAutocomplete.test.tsx` → FAIL.
- [ ] **Step 3:** In the `Enter` case, do nothing while `searchText !== debouncedSearch || loading`. Also request alphabetical results: add `orderBy: "name", order: "asc"` to `filters` (check the patients list API's accepted sort keys in `src/api/patients/useFetchPatients.ts`; use the same key the Pacientes table uses).
- [ ] **Step 4:** Add test `it("lists patients alphabetically")` asserting the filters passed to `useFetchPatients` include that sort. Run → PASS.
- [ ] **Step 5:** Commit `fix(portal): patient picker ignores Enter until search results settle`.

### Task 2: Undefined color tokens leak light theme into dark mode (P1)

**Files:**
- Create: `Portal/test/utils/themeTokens.test.ts`
- Modify: `components/Calendar/WeekView.tsx:57,60,136,206`, `components/Calendar/styles.ts:24,81,87`, `components/Calendar/DayView.tsx:138`, `components/Info/ChannelBanner.tsx:35-36`, `app/error.tsx:24,28,31`, `components/AuthGuard.tsx:25`, `components/ErrorBoundary.tsx:37`, `components/MedicalRecord/DocumentsSection.tsx:190,410`, `components/Settings/GoogleIntegrationTab.tsx:123,130,163`, `app/google/oauth-complete/page.tsx:76,101`, `app/globals.css` (`.bulk-info__title`, ~line 3373)

- [ ] **Step 1: Failing test** (model on `test/utils/publicTheme.test.ts`): scan every `.ts/.tsx/.css` under `src/` for `var(--c-…)` (with or without fallback) and assert each token is declared in both theme blocks; also assert `.bulk-info__title` contains no hex color. Expected missing today: `--c-bg --c-brand-200 --c-brand-50 --c-danger --c-green --c-green-100 --c-primary --c-primary-50 --c-red --c-text --c-text-muted --c-text-sub`.
- [ ] **Step 2:** Run → FAIL listing those tokens.
- [ ] **Step 3:** Replace, dropping hex fallbacks: `--c-primary`→`--c-brand`; `--c-primary-50`→`--c-today-bg`; `--c-brand-50`→`--c-info-bg`; `--c-brand-200`→`--c-info-border`; `--c-danger`/`--c-red`→`--c-error`; `--c-green`→`--c-success`; `--c-green-100`→`--c-success-bg`; `--c-bg`→`--c-page-bg`; `--c-text`→`--c-gray-900`; `--c-text-sub`→`--c-gray-500`; `--c-text-muted`→`--c-gray-400`. `.bulk-info__title` color → `var(--c-gray-900)`. ChannelBanner text must reach 4.5:1 on `--c-info-bg` in both themes (use `--c-gray-900`).
- [ ] **Step 4:** Run the new test + `test/components/Calendar` + `GoogleIntegrationTab.test.tsx` → PASS. Browser check: week view today column matches month view (brand/today tokens, no white column); Envío masivo banner title readable.
- [ ] **Step 5:** Commit `fix(portal): replace undefined color tokens and guard them with a test`.

### Task 3: List tables hide status, payment and actions at 1280px (P1)

**Files:**
- Modify: `Portal/src/components/DataTable.tsx` (`ColumnDef`), `src/app/globals.css` (`.table-card`, `.th`, `.td`), callers: `app/(provider)/(protected)/{appointments,patients,reminders}/page.tsx`, `components/AuditLogs/AuditLogsView.tsx`
- Create: `Portal/e2e/tests/table-fit.spec.ts`

- [ ] **Step 1: Failing e2e** `table-fit.spec.ts` (chromium project, 1280×720): for `/appointments`, `/patients`, `/reminders?activeTab=History`, `/activity`, wait for the first `tbody tr`, assert `table.scrollWidth <= table.parentElement.clientWidth`, and that the actions column (last `th`) is inside the viewport.
- [ ] **Step 2:** Run `pnpm exec playwright test e2e/tests/table-fit.spec.ts --project=chromium` → FAIL (today: Citas 1526 vs 933, Pacientes 1116 vs 933).
- [ ] **Step 3:** Add `ColumnDef.priority?: "secondary"`; DataTable puts `col--secondary` on that `th`; callers put the same class on the matching `td`. Make `.table-card` a container (`container-type: inline-size`) and hide `.col--secondary` under `@container (max-width: 1100px)`. Make the last column sticky right (`.col--actions { position: sticky; right: 0; background: var(--c-surface) }`). Secondary columns: Citas → Ubicación, Recordatorio; Pacientes → SMS, Registrado; Recordatorios historial → ID mensaje, Última actualización; Actividad → Origen. Reduce `.th/.td` horizontal padding to 14px under the same container query if still over.
- [ ] **Step 4:** Rerun e2e → PASS; run `test/components` files that render these tables.
- [ ] **Step 5:** Commit `fix(portal): fit list tables at 1280px with secondary columns and sticky actions`.

### Task 4: Fetch errors render as "0" and "nothing yet" (P1)

**Files:**
- Modify: `components/Info/StatCard.tsx`, `app/(provider)/(protected)/{reminders,dashboard,appointments,patients}/page.tsx`
- Test: `Portal/test/components/StatCard.test.tsx` (create), reminders page test if present

- [ ] **Step 1: Failing tests:** `StatCard` with `value={undefined}` renders `—`; Recordatorios page with the list fetch erroring shows the error banner and does NOT render "Sin recordatorios activos".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `StatCard.value: number | string | undefined` → render `—` when undefined; pages pass `stats?.x` (drop `?? 0`). Pages render `emptyState` only when `!error`.
- [ ] **Step 4:** Run → PASS. Commit `fix(portal): show unknown stats and no empty state when a fetch fails`.

### Task 5: Notices channel without an address (P1)

**Files:**
- Modify: `Portal/src/components/Settings/RemindersTab.tsx` (the Notificaciones section, "Canal de tus avisos")
- Test: `Portal/test/components/Settings/RemindersTab.test.tsx`

- [ ] **Step 1: Failing test:** channel WhatsApp, notices on, empty WhatsApp number → an inline warning "No tienes un número de WhatsApp. No recibirás avisos hasta que lo agregues." is shown next to the WhatsApp field (same for SMS/Teléfono).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the warning (field-level, uses `--c-warning-*` tokens). **Step 4:** Run → PASS. Commit.

### Task 6: Stat cards, metric labels and reminder month bounds

**Files:**
- Modify: `src/app/globals.css` (`.stats-grid`, `.stats-grid--5`, `.stat-card`, `.stat-card__value`), `app/(provider)/(protected)/dashboard/page.tsx:150-167,254,350`, `appointments/page.tsx:333-349`
- Modify: `Server/src/reminders/reminder.repository.ts:138-157`; Test: `Server/test/integration/reminders/` (stats test)

- [ ] **Step 1: Failing Server integration test:** with no range, a reminder whose `sendAt` is next month is NOT counted in `getStats`.
- [ ] **Step 2:** Run `pnpm exec vitest run <that file>` → FAIL. **Step 3:** default range = `getCurrentMonthBoundsInTz(timezone)` start AND end (`lte: end`). **Step 4:** PASS.
- [ ] **Step 5:** CSS: `.stats-grid` ≥1024px → `repeat(auto-fit, minmax(160px, 1fr))`; delete `.stats-grid--5` usages/rules; `.stat-card { min-width: 0 }`; `.stat-card__value { font-size: clamp(24px, 2.4vw, 36px) }`. Browser check: equal widths, icon top-right on every page.
- [ ] **Step 6:** Labels: dashboard Recordatorios sub → "pendientes este mes"; quick access desc → `${total} programados este mes`; dashboard Ingresos sub → "total histórico cobrado"; Citas "Próximas"/"sin confirmar" → label "Sin confirmar", sub "citas programadas"; Citas Ingresos del mes sub → "cobrado este mes". Update tests that assert these strings. Commit.

### Task 7: Formatting consistency (money, time, week start, month labels)

**Files:**
- Modify: `src/utils/TimeUtils.ts` (or a new `src/utils/money.ts` exporting `fmtMoney(n: number): string`), `components/AppointmentTypeCard.tsx:55`, all `toLocaleString("es-ES")` money call sites (`grep -rn '\$ \${' src`), `fmtTimestamp` (Actividad), `components/Calendar/useCalendarData.ts:103-106`, `components/PublicBooking/MonthCalendar.tsx:5`, `utils/publicBooking.ts:92-94`, calendar hour axis in `WeekView.tsx`/`DayView.tsx`, `getTomorrowSixAm` (`TimeUtils.ts:336-341`, used by `Modals/AppointmentModal/index.tsx:77,84,92`)
- Test: `test/utils/TimeUtils.test.ts`, `test/utils/publicBooking.test.ts`, `test/utils/money.test.ts` (create)

- [ ] **Step 1: Failing tests:** `fmtMoney(150000) === "$ 150.000"`; `monthGrid("2026-11")` starts with 6 nulls (Nov 1 2026 is Sunday, Monday-first); week nav label `"9–15 de noviembre de 2026"`, month label `"Noviembre de 2026"`; `fmtTimestamp` returns the same shape as `fmtDateTime`, without seconds (`"15 nov 2026, 01:01 p. m."`); calendar hour label for 15 → `"3 p. m."`; new appointment default = tomorrow 09:00 local.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement: `fmtMoney` via `Intl.NumberFormat("es-CO")`; WEEKDAYS `["L","M","X","J","V","S","D"]` and leading blanks `(getUTCDay()+6)%7`; rename `getTomorrowSixAm`→`getTomorrowAt(time: string, timezone?: string)` and use `"09:00:00"` for the default start (keep `"06:00:00"` for the two `dateFrom` fetches). Native `<input type="time">` in availability settings stays browser-controlled.
- [ ] **Step 4:** Run → PASS (update e2e `public/book*.spec.ts` selectors if they rely on Sunday-first columns). Commit.

### Task 8: Copy, naming and accents

**Files:** `app/(provider)/(protected)/calendar/page.tsx:124`, `components/AuditLogs/AuditLogsView.tsx:107,130,182`, `utils/TimeUtils.ts:52-58` (`fmtTimezoneLabel`), `components/Modals/AppointmentModal/index.tsx:287`, `components/Reminders/BulkSendWizard/WizardStepper.tsx:13`, `components/Settings/GoogleIntegrationTab.tsx:109`, `components/Settings/SecurityTab.tsx:65,78,92`, `appointments/page.tsx:463`, `src/types/AuditLog.ts:65-74` (entity labels: "Historia clínica", "Tipo de cita", "Ubicación", "Tiempo bloqueado", "Conexión de Google"), all Title Case buttons/labels (`grep -rnE '"(Nueva|Nuevo|Bloquear|Envío|Vista|Sin|Citas) [A-Z]' src`), public `ProviderPanel`/`ProviderHeader` title line.

- [ ] **Step 1: Failing tests:** `fmtTimezoneLabel("America/Bogota")` → `"Bogotá (GMT-5)"` (take the city from `COMMON_TIMEZONES` label after `— ` when present); AuditLogsView headers "Acción", "Descripción"; calendar page heading "Calendario"; public panel with `title === specialty prefix` shows each once.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Apply: page title "Calendario"; "Acción", "Descripción", placeholder "Buscar por actor, descripción o entidad…"; steps "Paciente y tipo", "Lugar y hora", "Pago y estado"; bulk stepper "Envío", "Pacientes", "Plantilla"; Google not connected → icon neutral, text "Conecta tu cuenta de Google para crear enlaces de Meet."; password placeholders removed; sentence case everywhere ("Nueva cita", "Nuevo paciente", "Nuevo recordatorio", "Bloquear horario", "Envío masivo", "Vista general", "Sin pagar", "Citas hoy", "Sin recordatorio"); public panel shows specialty only when it differs from the title.
- [ ] **Step 4:** Update unit tests, `e2e/pages/*`, and `e2e/tests/*` that match the old strings (`grep -rn` each old string under `Portal/test` and `Portal/e2e`). Run affected files → PASS. Commit.

### Task 9: Login audit rows (Server + Portal labels)

**Files:** `Server/schema.prisma:746` (`ActionType`), new migration, `Server/src/auth/auth.service.ts:83-91`, `Portal/src/types/AuditLog.ts`; Test: `Server/test/integration/auth/` login test

- [ ] **Step 1: Failing integration test:** after a successful login, the newest audit row for the user has `actionType: LOGIN`, `source: API`, `actorId: user.id`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Add `LOGIN` to `ActionType`; generate migration (`ALTER TYPE "ActionType" ADD VALUE 'LOGIN'`), inspect SQL per Global Constraints, `pnpm exec prisma generate`; in `auth.service.ts` call `logAudit` with `actionType: ActionType.LOGIN`, `source: ActionSource.API`, `actorId: user.id`, `actorDisplayName` = the same display-name value the authenticated audit context uses for a provider (`buildAuditEntry` in `src/audit-log/audit-log.utils.ts:35-54` spreads these overrides over the context defaults). Portal: add `LOGIN = "LOGIN"` to `ActionType` in `src/types/AuditLog.ts:17` with label "Inicio de sesión" and an icon, and add it to the Actividad action filter options.
- [ ] **Step 4:** Run → PASS. Commit.

### Task 10: Visual polish (CSS-only, browser-verified)

**Files:** `src/app/globals.css`, `components/Settings/AccountProfile.tsx` (avatar), `components/MedicalRecord/DocumentsSection.tsx` + `components/Settings/PracticeProfile.tsx` (dropzones), `components/DateTimePicker.tsx`/`ZonedDatePicker.tsx` (field style), `components/Settings/OnlineBooking/ApprovalSection.tsx:45` + `components/Drawers/RequestDrawer.tsx` (radios), settings helper text class, delete buttons (`btn-action-delete`, services/location cards, availability rows, `components/EvolutionNotes.tsx:52` "Eliminar"), calendar event chips (`components/Calendar/styles.ts`), Usuarios "Nuevo usuario" and Actividad refresh placement.

- [ ] **Step 1:** Avatar: fixed square box + `aspect-ratio: 1; object-fit: cover; border-radius: 50%`. Dropzones: icon centered above text. Date picker field: same height/background/padding as `.form-input`. Radios: one shared `.radio` style using `accent-color: var(--c-brand)`. Helper text: one `.form-hint` left-aligned under its field. Delete: one style = icon button, trash icon, `--c-error` tint, `aria-label`. Event chips: min font 12px; past events `opacity ≥ 0.7`. Usuarios: "Nuevo usuario" moves into `PageHeader` actions; Actividad refresh into `PageHeader` actions.
- [ ] **Step 2:** Run `test/components` files for touched components and `e2e/tests/public/legibility.spec.ts` (public pages untouched but shared CSS) → PASS.
- [ ] **Step 3:** Browser walkthrough at 1280px of every changed screen in dark theme; screenshot before/after. Commit `style(portal): unify inputs, radios, hints, delete actions and avatars`.

## Not in scope

- Seed/test data shown on the public page ("sdsdsds" service, "www" legal fields): edit in Configuración, not code.
- Phone-width review: the browser window could not be resized in the review session; run it separately with the `mobile` Playwright project.
