import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { createTestPatient, createTestAppointment, createTestReminder, createTestMedicalRecord } from '../../utils/helpers';

// Phase 0 of issue #123 (provider portal mobile layout): locks in 16px fields, >=44px touch targets,
// no sideways page scroll and the touch pickers (phase 3) on a coarse-pointer phone (Pixel 7 emulation).

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
  // Polling/websocket pages may never go idle; a bounded wait is enough for data to render.
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
          // Settled reminders populate the History tab.
          await api.cancelReminder(reminder.data.id);
        }
        if (seed.includes('record')) {
          const record = await createTestMedicalRecord(api, patient.id, patient.name);
          trackedMedicalRecords.track(record.data.id);
        }
      }

      await page.goto(path);
      await settle(page);

      // 1. No sideways page scroll (scroll containers inside tables are allowed for now).
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        overflow.scrollWidth - overflow.innerWidth,
        `page scrolls sideways: scrollWidth ${overflow.scrollWidth} vs viewport ${overflow.innerWidth}`,
      ).toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);

      // 2. Text-like fields are >= 16px (below that iOS Safari zooms on focus).
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

      // 3. Listed controls, where visible, are >= 44x44.
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

  test('block-time pickers open a touch sheet and pick a date and time without a keyboard', async ({ page }) => {
    await page.goto('/calendar');
    await settle(page);
    await page.getByTestId('calendar-block-time-button').click();
    const dialog = page.getByTestId('blocked-time-modal-dialog');
    await expect(dialog).toBeVisible();
    // Phase 3: touch screens get the sheet pickers, not antd's text inputs.
    await expect(dialog.locator('.ant-picker')).toHaveCount(0);

    const trigger = dialog.getByTestId('blocked-time-start-input');
    await trigger.click();
    const sheet = page.getByTestId('blocked-time-start-input-sheet');
    await expect(sheet).toBeVisible();
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(['INPUT', 'TEXTAREA'], 'nothing that opens the keyboard has focus').not.toContain(focusedTag);

    // Next month: every day there is in the future, whatever the time of day.
    await sheet.getByRole('button', { name: 'Mes siguiente' }).click();
    await sheet.locator('[role="grid"] button:not([disabled])').first().click();
    await expect(sheet.getByRole('tab', { name: /Hora/ })).toHaveAttribute('aria-selected', 'true');
    await sheet.getByRole('group', { name: 'Hora' }).locator('button:not([disabled])').first().click();
    await sheet.getByRole('group', { name: 'Minutos' }).locator('button:not([disabled])').first().click();

    // The confirm button the antd popup pushed off-screen must sit inside the viewport.
    const done = sheet.getByRole('button', { name: 'Listo' });
    await expect(done).toBeEnabled();
    const box = await done.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, 'Listo has a box').not.toBeNull();
    expect(box!.y + box!.height, 'Listo is above the bottom of the screen').toBeLessThanOrEqual(viewport.height);
    await done.click();

    await expect(sheet).toBeHidden();
    await expect(trigger).toHaveText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    await expect(dialog).toBeVisible();

    // Close without saving.
    await page.getByTestId('blocked-time-modal-close-button').click();
    await expect(dialog).toBeHidden();
  });
});
