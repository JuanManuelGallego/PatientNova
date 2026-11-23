import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { Routes } from '../utils/const';

async function openBlockTime(page: Page) {
  await page.goto(Routes.CALENDAR);
  await page.getByTestId('calendar-block-time-button').click();
  const dialog = page.getByTestId('blocked-time-modal-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('blocked-time-description-input')).toBeFocused();
  return dialog;
}

const TIME = /^\d{2}:\d{2}$/;

test.describe('Date and time picker (desktop)', () => {
  test('types a date and times into the block-time range', async ({ page }) => {
    const dialog = await openBlockTime(page);

    const date = dialog.getByTestId('blocked-time-date');
    const start = dialog.getByTestId('blocked-time-start');
    const end = dialog.getByTestId('blocked-time-end');
    const next = new Date();
    next.setMonth(next.getMonth() + 2);
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${pad(next.getDate())}/${pad(next.getMonth() + 1)}/${next.getFullYear()}`;
    await date.fill(day);
    await date.press('Enter');
    await expect(date).toHaveValue(day);

    await start.fill('1035');
    await start.press('Enter');
    await expect(start).toHaveValue('10:35');
    await end.fill('11:35');
    await end.press('Enter');
    await expect(end).toHaveValue('11:35');
    await expect(end).toHaveAccessibleDescription('1 h');

    await end.fill('99:99');
    await end.press('Enter');
    await expect(end).toHaveAttribute('aria-invalid', 'true');
    await end.blur();
    await expect(end).toHaveValue('11:35');
    await expect(end).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('picks times from the list with the mouse and the keyboard', async ({ page }) => {
    const dialog = await openBlockTime(page);

    const start = dialog.getByTestId('blocked-time-start');
    await start.click();
    const list = page.getByTestId('blocked-time-start-list');
    await expect(list).toBeVisible();
    await expect(start).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(list).toBeHidden();
    await expect(start).toHaveValue(TIME);

    const end = dialog.getByTestId('blocked-time-end');
    await end.click();
    const endList = page.getByTestId('blocked-time-end-list');
    await endList.getByRole('option', { name: /, 30 min$/ }).click();
    await expect(endList).toBeHidden();
    await expect(end).toHaveAccessibleDescription('30 min');
    await expect(dialog).toBeVisible();
  });

  test('Escape closes the list without closing the dialog', async ({ page }) => {
    const dialog = await openBlockTime(page);
    await dialog.getByTestId('blocked-time-start').click();
    await expect(page.getByTestId('blocked-time-start-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('blocked-time-start-list')).toBeHidden();
    await expect(dialog).toBeVisible();
  });
});
