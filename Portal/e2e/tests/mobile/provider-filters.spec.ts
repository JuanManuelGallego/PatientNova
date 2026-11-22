import { test, expect } from '../../fixtures';
import { createTestPatient, createTestAppointment } from '../../utils/helpers';

// Phase 2 of issue #123: on a phone, list filters and sorting live in one sheet opened from the card toolbar.
// The sheet's own fields and controls must meet the same touch rules as the pages (16px fields, 44px targets).

const MIN_FONT_PX = 16;
const MIN_TARGET_PX = 44;

test('Citas filter sheet is touch-sized, filters, clears and closes with Back', async ({
  page, api, trackedPatients, trackedAppointments,
}) => {
  const patient = await createTestPatient(api);
  trackedPatients.track(patient.id);
  const appt = await createTestAppointment(api, patient.id);
  trackedAppointments.track(appt.data.id);

  await page.goto(`/appointments?patientId=${patient.id}`);
  await expect(page.getByTestId(`appointment-card-${appt.data.id}`)).toBeVisible();

  // A real tap (user activation), so the sheet's history entry is one Back can close.
  const button = page.locator('.table-card-toolbar__button').first();
  await button.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();

  const problems = await sheet.evaluate((root, { minFont, minTarget }) => {
    const out: string[] = [];
    const skip = new Set([ 'checkbox', 'radio', 'hidden', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image' ]);
    root.querySelectorAll<HTMLElement>('input, textarea, select').forEach((el) => {
      if (el instanceof HTMLInputElement && skip.has(el.type)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < minFont) out.push(`field ${el.tagName.toLowerCase()} = ${size}px`);
    });
    root.querySelectorAll<HTMLElement>('button, [role="radio"], [role="option"], label:has(input[type="radio"])').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.height < minTarget) {
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 20);
        out.push(`target "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    });
    return out;
  }, { minFont: MIN_FONT_PX, minTarget: MIN_TARGET_PX });
  expect(problems, `filter sheet touch problems:\n${problems.join('\n')}`).toEqual([]);

  // Change a filter: the toolbar badge counts it; Limpiar clears it.
  await sheet.getByRole('option', { name: 'Sin pagar' }).click();
  await expect(button).toHaveAccessibleName(/Filtros, \d+ activos?/);
  await sheet.getByRole('button', { name: 'Limpiar' }).click();
  await expect(button).toHaveAccessibleName(/^Filtros$/);

  // Back closes the sheet and stays on Citas.
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/appointments/);
});
