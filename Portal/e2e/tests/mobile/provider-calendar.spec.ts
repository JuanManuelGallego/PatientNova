import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { createTestPatient, createTestAppointment } from '../../utils/helpers';
import { AppointmentDrawer } from '../../pages/Drawers/AppointmentDrawer';
import { AppointmentModal } from '../../pages/Modals/AppointmentModal';

const PROVIDER_TZ = 'America/Bogota';
const SCROLL_TOLERANCE_PX = 1;

function providerDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PROVIDER_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

function shiftDay(day: string, days: number): string {
  const [ y, m, d ] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

function weekOf(day: string): string[] {
  const [ y, m, d ] = day.split('-').map(Number);
  const isoWeekday = ((new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7) + 1;
  const monday = shiftDay(day, 1 - isoWeekday);
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth - innerWidth, `page scrolls sideways: ${scrollWidth} vs ${innerWidth}`).toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
}

test.describe('Calendar on a phone', () => {
  test('the agenda lists the appointment on its day, opens its drawer, and the floating button creates one', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    const appointment = await createTestAppointment(api, patient.id);
    trackedAppointments.track(appointment.data.id);
    const { data: created } = await api.getAppointment(appointment.data.id);
    expect(created.startAt, "the API returns the start").toBeTruthy();
    const day = providerDay(created.startAt!);
    const week = weekOf(day);
    const otherDay = day === week[ 0 ] ? week[ 1 ]! : week[ 0 ]!;

    await page.goto(`/calendar?view=day&day=${otherDay}`);

    await expect(page.getByTestId(`calendar-strip-day-${week[ 0 ]}`)).toBeInViewport();
    await expect(page.getByTestId(`calendar-strip-day-${week[ 6 ]}`)).toBeInViewport();
    const pill = page.getByTestId(`calendar-strip-day-${day}`);
    await expect(pill.getByTestId('calendar-strip-dot')).toBeVisible();

    await pill.click();
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    const item = page.getByTestId(`calendar-agenda-event-${appointment.data.id}`);
    await expect(item).toBeVisible();
    await expect(item).toContainText(patient.name);
    await expectNoSidewaysScroll(page);

    await item.click();
    const drawer = new AppointmentDrawer(page);
    await drawer.waitForOpen();
    await expect(drawer.patientName).toContainText(patient.name);
    await drawer.close();

    await expect(page.getByTestId('calendar-new-appointment-button')).toBeHidden();
    await expect(page.getByTestId('calendar-block-time-button')).toBeVisible();
    await page.getByTestId('calendar-fab-new-appointment').click();
    const modal = new AppointmentModal(page);
    await modal.waitForOpen();
    await modal.closeButton.click();
    await modal.waitForClose();
  });

  test('Mes is a day picker that opens the tapped day in the agenda', async ({ page }) => {
    await page.goto('/calendar?view=month');
    await page.getByTestId('calendar-today-button').click();
    const current = page.locator('[data-testid^="calendar-month-day-"][aria-current="date"]');
    await expect(current).toBeVisible();
    await expect(page.locator('.cal-grid')).toHaveCount(0);
    const testId = await current.getAttribute('data-testid');
    const day = testId!.replace('calendar-month-day-', '');

    await current.click();
    await expect(page).toHaveURL(/view=day/);
    await expect(page.getByTestId(`calendar-strip-day-${day}`)).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('at 360px', () => {
    test.use({ viewport: { width: 360, height: 760 } });

    for (const view of [ 'day', 'month' ]) {
      test(`the ${view} view does not scroll sideways`, async ({ page }) => {
        await page.goto(`/calendar?view=${view}`);
        await expect(page.getByTestId('calendar-today-button')).toBeVisible();
        await expectNoSidewaysScroll(page);
        await expect(page.getByTestId('calendar-fab-new-appointment')).toBeInViewport();
      });
    }
  });
});

test.describe('Citas on a phone', () => {
  test('the floating button opens the new-appointment modal and never covers the last card', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    for (let i = 0; i < 3; i++) {
      const appointment = await createTestAppointment(api, patient.id);
      trackedAppointments.track(appointment.data.id);
    }
    await page.goto(`/appointments?patientId=${patient.id}`);
    const cards = page.locator('[data-testid^="appointment-card-"]');
    await expect(cards).toHaveCount(3);
    await expect(page.getByTestId('appointments-new-button')).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const fab = page.getByTestId('appointments-fab-new-appointment');
    const last = await cards.last().boundingBox();
    const button = await fab.boundingBox();
    expect(last && button, 'card and button are laid out').toBeTruthy();
    expect(last!.y + last!.height).toBeLessThanOrEqual(button!.y);

    await fab.click();
    const modal = new AppointmentModal(page);
    await modal.waitForOpen();
    await modal.closeButton.click();
    await modal.waitForClose();

    await page.getByTestId('appointments-search-input').focus();
    await expect(fab).toBeHidden();
    await page.getByTestId('appointments-search-input').blur();
    await expect(fab).toBeVisible();
  });
});
