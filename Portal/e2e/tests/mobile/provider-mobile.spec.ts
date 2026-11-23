import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { createTestPatient, createTestAppointment, createTestReminder, createTestMedicalRecord } from '../../utils/helpers';

const MIN_FONT_PX = 16;
const MIN_TARGET_PX = 44;
const SCROLL_TOLERANCE_PX = 1;

type Seed = 'patient' | 'appointment' | 'reminder' | 'record';

const PAGES: { name: string; path: string; seed: Seed[] }[] = [
  { name: 'Dashboard', path: '/dashboard', seed: ['patient', 'appointment'] },
  { name: 'Calendario', path: '/calendar', seed: [] },
  { name: 'Citas', path: '/appointments', seed: ['patient', 'appointment'] },
  { name: 'Pacientes', path: '/patients', seed: ['patient'] },
  { name: 'Recordatorios', path: '/reminders', seed: ['patient', 'reminder'] },
  { name: 'Recordatorios (historial)', path: '/reminders?activeTab=History', seed: ['patient', 'reminder'] },
  { name: 'Solicitudes', path: '/requests', seed: [] },
  { name: 'Expedientes', path: '/medical-records', seed: ['patient', 'record'] },
  { name: 'Actividad', path: '/activity', seed: [] },
  { name: 'Ajustes de reservas', path: '/settings/booking', seed: [] },
];

const TARGET_SELECTORS = [
  '.th-filter-btn',
  '.btn-table-action',
  '.pagination-btn',
  '.pagination-num',
  '.tab-nav button',
  '.navbar-hamburger',
  '.table-compact-control',
  '.table-card-toolbar__button',
  '.data-card',
];

async function settle(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
}

test.describe('Provider pages on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    expect(coarse, 'Pixel 7 emulation must match (pointer: coarse); the touch rules depend on it').toBe(true);
  });

  for (const { name, path, seed } of PAGES) {
    test(`${name} (${path}) fits and has touch-sized fields and controls`, async ({
      page, api, trackedPatients, trackedAppointments, trackedReminders, trackedMedicalRecords,
    }) => {
      if (seed.length) {
        const patient = await createTestPatient(api);
        trackedPatients.track(patient.id);
        if (seed.includes('appointment')) {
          const appt = await createTestAppointment(api, patient.id);
          trackedAppointments.track(appt.data.id);
        }
        if (seed.includes('reminder')) {
          const reminder = await createTestReminder(api, patient.id);
          trackedReminders.track(reminder.data.id);
          await api.cancelReminder(reminder.data.id);
        }
        if (seed.includes('record')) {
          const record = await createTestMedicalRecord(api, patient.id, patient.name);
          trackedMedicalRecords.track(record.data.id);
        }
      }

      await page.goto(path);
      await settle(page);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        overflow.scrollWidth - overflow.innerWidth,
        `page scrolls sideways: scrollWidth ${overflow.scrollWidth} vs viewport ${overflow.innerWidth}`,
      ).toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);

      const smallFields = await page.evaluate((min) => {
        const skip = new Set(['checkbox', 'radio', 'hidden', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image']);
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>('input, textarea, select').forEach((el) => {
          if (el instanceof HTMLInputElement && skip.has(el.type)) return;
          const rect = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') return;
          const size = parseFloat(cs.fontSize);
          if (size < min) {
            const id = el.getAttribute('data-testid') ?? el.id;
            const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
            out.push(`${el.tagName.toLowerCase()}${el instanceof HTMLInputElement ? `[type=${el.type}]` : ''}${id ? `#${id}` : ''}${cls ? `.${cls}` : ''} = ${size}px`);
          }
        });
        return out;
      }, MIN_FONT_PX);
      expect(smallFields, `fields under ${MIN_FONT_PX}px font-size:\n${smallFields.join('\n')}`).toEqual([]);

      const small: string[] = [];
      for (const selector of TARGET_SELECTORS) {
        const found = await page.locator(selector).evaluateAll((els, min) => els.flatMap((el, i) => {
          const rect = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') return [];
          if (rect.width >= min && rect.height >= min) return [];
          const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 20);
          return [`#${i} "${label}" ${Math.round(rect.width * 10) / 10}x${Math.round(rect.height * 10) / 10}`];
        }), MIN_TARGET_PX);
        small.push(...found.map((f) => `${selector} ${f}`));
      }
      expect(small, `controls under ${MIN_TARGET_PX}x${MIN_TARGET_PX}:\n${small.join('\n')}`).toEqual([]);
    });
  }

  test('block-time pickers open touch sheets and pick a day and times without a keyboard', async ({ page }) => {
    await page.goto('/calendar');
    await settle(page);
    await page.getByTestId('calendar-block-time-button').click();
    const dialog = page.getByTestId('blocked-time-modal-dialog');
    await expect(dialog).toBeVisible();

    const date = dialog.getByTestId('blocked-time-date');
    await date.click();
    const dateSheet = page.getByTestId('blocked-time-date-sheet');
    await expect(dateSheet).toBeVisible();
    await dateSheet.getByRole('button', { name: 'Mes siguiente' }).click();
    await dateSheet.getByRole('table').locator('button:not([disabled])').first().click();
    await expect(dateSheet).toBeHidden();
    await expect(date).toHaveText(/\d{2}\/\d{2}\/\d{4}/);

    const start = dialog.getByTestId('blocked-time-start');
    await start.click();
    const sheet = page.getByTestId('blocked-time-start-sheet');
    await expect(sheet).toBeVisible();
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(['INPUT', 'TEXTAREA'], 'nothing that opens the keyboard has focus').not.toContain(focusedTag);

    const option = sheet.getByRole('option', { name: '10:00' });
    await option.scrollIntoViewIfNeeded();
    const box = await option.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, 'the row has a box').not.toBeNull();
    expect(box!.y + box!.height, 'the row is above the bottom of the screen').toBeLessThanOrEqual(viewport.height);
    await option.click();

    await expect(sheet).toBeHidden();
    await expect(start).toHaveText('10:00');
    await expect(dialog.getByTestId('blocked-time-end')).toHaveText(/^1\d:\d{2}$/);
    await expect(dialog).toBeVisible();

    await page.getByTestId('blocked-time-modal-close-button').click();
    await expect(dialog).toBeHidden();
  });
});
