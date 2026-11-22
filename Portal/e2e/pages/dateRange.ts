import { expect, type Page } from '@playwright/test';

const toField = (value: string) => {
  const [ year, month, day ] = value.split('T')[ 0 ].split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Picks a custom range in a `DateRangePicker` already visible on the page (open its filter popover first):
 * chooses Personalizado, then types Desde and Hasta ("YYYY-MM-DD" or an ISO instant).
 */
export async function pickCustomRange(page: Page, rangeTestId: string, from: string, to: string) {
  const range = page.getByTestId(rangeTestId);
  await range.getByRole('button', { name: 'Personalizado' }).click();
  const desde = page.getByTestId(`${rangeTestId}-from`);
  await desde.fill(toField(from));
  await desde.press('Enter');
  await expect(desde).toHaveValue(toField(from));
  const hasta = page.getByTestId(`${rangeTestId}-to`);
  await hasta.fill(toField(to));
  await hasta.press('Enter');
  await expect(hasta).toHaveValue(toField(to));
}
