import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { createTestPatient, createTestAppointment } from '../../utils/helpers';

// Phase 3 of issue #123: on a phone the date-range filter is presets plus two single-day picker sheets, inside the
// Phase 2 filter sheet. A picker closes by going back over its own history entry while the filter writes the URL
// (nuqs replaceState); the filter must stay in the URL and the list must stay filtered after the sheets close.

const RANGE = 'appointment-date-range-filter';
const PARAM = /[?&]dateFilter=(\d{4}-\d{2}-\d{2})(?:,|%2C)(\d{4}-\d{2}-\d{2})/;

/** 15:00–16:00 UTC (same calendar day from UTC−12 to UTC+8) on `day` of the month `monthsAhead` from now. */
function slot(monthsAhead: number, day: number, hour = 15) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, day, hour));
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString() };
}

async function openFilters(page: Page): Promise<Locator> {
  // A real tap (user activation), so the sheet's history entry is one Back can close.
  await page.locator('.table-card-toolbar__button').first().click();
  const sheet = page.getByRole('dialog', { name: /Filtros/ });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function closeFilters(page: Page, sheet: Locator) {
  await sheet.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(sheet).toBeHidden();
}

/** The URL keeps the range after every sheet has closed and the history traversals have landed. */
async function expectRangeKept(page: Page): Promise<[ string, string ]> {
  await expect(page).toHaveURL(PARAM);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(PARAM);
  const [ , from, to ] = PARAM.exec(page.url())!;
  return [ from, to ];
}

test.describe('Citas date filter on a phone', () => {
  test('a preset applies, survives the sheets closing and filters the list', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    // Two months ahead: outside Hoy, Esta semana and Este mes whatever today is.
    const far = await createTestAppointment(api, patient.id, slot(2, 12, 13 + Math.floor(Math.random() * 4)));
    trackedAppointments.track(far.data.id);

    await page.goto(`/appointments?patientId=${patient.id}`);
    await expect(page.getByTestId(`appointment-card-${far.data.id}`)).toBeVisible();

    const sheet = await openFilters(page);
    await sheet.getByTestId(RANGE).getByRole('button', { name: 'Este mes' }).click();
    await expect(sheet.getByTestId(RANGE).getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');
    await closeFilters(page, sheet);

    const [ from, to ] = await expectRangeKept(page);
    expect(from.slice(8), 'Este mes starts on the 1st').toBe('01');
    expect(from.slice(0, 7)).toBe(to.slice(0, 7));
    await expect(page.getByTestId(`appointment-card-${far.data.id}`)).toBeHidden();
  });

  test('Personalizado picks Desde and Hasta in sheets, and the range survives them closing', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    const hour = 13 + Math.floor(Math.random() * 4);
    const inside = await createTestAppointment(api, patient.id, slot(1, 11, hour));
    trackedAppointments.track(inside.data.id);
    const outside = await createTestAppointment(api, patient.id, slot(1, 20, hour));
    trackedAppointments.track(outside.data.id);

    await page.goto(`/appointments?patientId=${patient.id}`);
    await expect(page.getByTestId(`appointment-card-${inside.data.id}`)).toBeVisible();
    await expect(page.getByTestId(`appointment-card-${outside.data.id}`)).toBeVisible();

    const sheet = await openFilters(page);
    const range = sheet.getByTestId(RANGE);
    await range.getByRole('button', { name: 'Personalizado' }).click();

    // Desde: the 10th of next month. The date-only sheet confirms on the tap.
    await page.getByTestId(`${RANGE}-from`).click();
    const fromSheet = page.getByTestId(`${RANGE}-from-sheet`);
    await expect(fromSheet).toBeVisible();
    await fromSheet.getByRole('button', { name: 'Mes siguiente' }).click();
    await fromSheet.getByRole('table').getByRole('button', { name: / 10 de / }).click();
    await expect(fromSheet).toBeHidden();
    await expect(page.getByTestId(`${RANGE}-from`)).toHaveText(/^10\//);
    await expect(page, 'a lone Desde applies nothing').not.toHaveURL(PARAM);

    // Hasta opens on Desde's month.
    await page.getByTestId(`${RANGE}-to`).click();
    const toSheet = page.getByTestId(`${RANGE}-to-sheet`);
    await expect(toSheet).toBeVisible();
    await expect(toSheet.getByRole('table').getByRole('button', { name: / 9 de / })).toBeDisabled();
    await toSheet.getByRole('table').getByRole('button', { name: / 12 de / }).click();
    await expect(toSheet).toBeHidden();

    // The filter sheet is still open and the range is already in the URL.
    await expect(sheet).toBeVisible();
    const [ from, to ] = await expectRangeKept(page);
    expect(from.slice(8)).toBe('10');
    expect(to.slice(8)).toBe('12');

    await closeFilters(page, sheet);
    await expectRangeKept(page);
    await expect(page.getByTestId(`appointment-card-${inside.data.id}`)).toBeVisible();
    await expect(page.getByTestId(`appointment-card-${outside.data.id}`)).toBeHidden();
  });
});
