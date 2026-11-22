import { test, expect } from '../fixtures';
import { Routes } from '../utils/const';

const DATE_TIME = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;

test.describe('Date and time picker (desktop)', () => {
  test('types a date and time into the field', async ({ page }) => {
    await page.goto(Routes.CALENDAR);
    await page.getByTestId('calendar-block-time-button').click();
    const dialog = page.getByTestId('blocked-time-modal-dialog');
    await expect(dialog).toBeVisible();

    const start = dialog.getByTestId('blocked-time-start-input');
    const next = new Date();
    next.setMonth(next.getMonth() + 2);
    const pad = (n: number) => String(n).padStart(2, '0');
    const text = `${pad(next.getDate())}/${pad(next.getMonth() + 1)}/${next.getFullYear()} 10:30`;
    await start.fill(text);
    await start.press('Enter');
    await expect(start).toHaveValue(text);

    await start.fill('99/99/9999 99:99');
    await expect(start).toHaveAttribute('aria-invalid', 'true');
    await start.blur();
    await expect(start).toHaveValue(text);
  });

  test('picks a date and time from the dialog with the mouse and keyboard', async ({ page }) => {
    await page.goto(Routes.CALENDAR);
    await page.getByTestId('calendar-block-time-button').click();
    const dialog = page.getByTestId('blocked-time-modal-dialog');
    await expect(dialog).toBeVisible();

    const start = dialog.getByTestId('blocked-time-start-input');
    await dialog.getByTestId('blocked-time-start-input-open').click();
    const sheet = page.getByTestId('blocked-time-start-input-sheet');
    await expect(sheet).toBeVisible();

    await expect(sheet.getByRole('table').locator('button[tabindex="0"]')).toBeFocused();
    await page.keyboard.press('PageDown');
    await page.keyboard.press('Enter');
    await expect(sheet.getByRole('tab', { name: /Hora/ })).toHaveAttribute('aria-selected', 'true');

    await sheet.getByRole('group', { name: 'Hora' }).locator('button:not([disabled])').first().click();
    await sheet.getByRole('group', { name: 'Minutos' }).locator('button:not([disabled])').first().click();
    await sheet.getByRole('button', { name: 'Listo' }).click();

    await expect(sheet).toBeHidden();
    await expect(start).toHaveValue(DATE_TIME);
    await expect(dialog).toBeVisible();
  });
});
