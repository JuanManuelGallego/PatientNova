import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import type { ApiClient } from '../../utils/api';
import { createTestPatient, createTestAppointment } from '../../utils/helpers';
import { AppointmentDrawer } from '../../pages/Drawers/AppointmentDrawer';
import { AppointmentModal } from '../../pages/Modals/AppointmentModal';
import { SidebarPage } from '../../pages/SidebarPage';

type Tracker = { track: (id: string) => void };

test.describe('Back button on provider pages (phone)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  type Seed = { api: ApiClient; trackedPatients: Tracker; trackedAppointments: Tracker };

  async function openAppointments(page: Page, { api, trackedPatients, trackedAppointments }: Seed, count = 1) {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    let lastId = '';
    for (let i = 0; i < count; i++) {
      const appointment = await createTestAppointment(api, patient.id);
      trackedAppointments.track(appointment.data.id);
      lastId = appointment.data.id;
    }

    await page.goto(`/appointments?patientId=${patient.id}`);
    const card = page.getByTestId(`appointment-card-${lastId}`);
    await expect(card).toBeVisible();
    return card;
  }

  async function openDrawer(card: Locator, page: Page) {
    await card.click();
    const drawer = new AppointmentDrawer(page);
    await drawer.waitForOpen();
    return drawer;
  }

  test('Back closes the appointment drawer and stays on Citas', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const row = await openAppointments(page, { api, trackedPatients, trackedAppointments });
    const drawer = await openDrawer(row, page);

    await page.goBack();

    await drawer.waitForClose();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(row).toBeVisible();
  });

  test('Back closes the edit modal opened from the drawer, and only that', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const row = await openAppointments(page, { api, trackedPatients, trackedAppointments });
    const drawer = await openDrawer(row, page);
    await drawer.editButton.click();
    const modal = new AppointmentModal(page);
    await expect(modal.dialog).toBeVisible();

    await page.goBack();
    await expect(modal.dialog).toBeHidden();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(row).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('closing the drawer from its button leaves no extra Back step', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const row = await openAppointments(page, { api, trackedPatients, trackedAppointments });
    const drawer = await openDrawer(row, page);
    await drawer.close();
    // Closing goes back over the drawer's entry on a later task: wait for it, or our Back races it.
    await expect.poll(() => page.evaluate(() => window.history.state?.overlay)).toBeUndefined();

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Back closes the open menu and stays on the page', async ({ page }) => {
    await page.goto('/appointments');
    const sidebar = new SidebarPage(page);
    await sidebar.openOnMobile();

    await page.goBack();

    await expect(sidebar.sidebar).not.toHaveClass(/sidebar--open/);
    await expect(sidebar.backdrop).toBeHidden();
    await expect(page).toHaveURL(/\/appointments/);
  });

  test('a menu link replaces the menu entry, so Back returns to the page it left', async ({ page }) => {
    await page.goto('/appointments');
    const sidebar = new SidebarPage(page);
    await sidebar.openOnMobile();

    await sidebar.clickLink('patients');
    await expect(page).toHaveURL(/\/patients/);
    await expect(sidebar.sidebar).not.toHaveClass(/sidebar--open/);

    await page.goBack();
    await expect(page).toHaveURL(/\/appointments/);
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });
  test('the list keeps its scroll position when the drawer closes, by button or by Back', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    await openAppointments(page, { api, trackedPatients, trackedAppointments }, 10);
    const rows = page.locator('[data-testid^="appointment-card-"]');
    await expect(rows).toHaveCount(10);
    const lastRow = rows.last();
    await lastRow.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before, 'the list must be long enough to scroll on a phone').toBeGreaterThan(100);
    const scrollY = () => page.evaluate(() => window.scrollY);

    const drawer = await openDrawer(lastRow, page);
    await drawer.close();
    await expect.poll(scrollY).toBeGreaterThan(before - 2);
    expect(await scrollY()).toBeLessThan(before + 2);

    await openDrawer(lastRow, page);
    await page.goBack();
    await drawer.waitForClose();
    await expect.poll(scrollY).toBeGreaterThan(before - 2);
    expect(await scrollY()).toBeLessThan(before + 2);
  });

  test('a link in the drawer replaces its entry, so Back returns to Citas and then leaves', async ({
    page, api, trackedPatients, trackedAppointments,
  }) => {
    const row = await openAppointments(page, { api, trackedPatients, trackedAppointments });
    const drawer = await openDrawer(row, page);

    await drawer.auditLink.click();
    await expect(page).toHaveURL(/\/activity/);

    await page.goBack();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(drawer.panel).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logging out from the open menu lands on the login page', async ({ page }) => {
    await page.route('**/auth/logout', (route) => route.fulfill({ status: 204 }));
    await page.goto('/appointments');
    const sidebar = new SidebarPage(page);
    await sidebar.openOnMobile();
    await sidebar.openUserMenu();

    await sidebar.logoutButton.click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-email-input')).toBeVisible();
  });
});
