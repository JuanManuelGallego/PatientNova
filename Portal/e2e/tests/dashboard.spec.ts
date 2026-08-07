import { test, expect } from '../fixtures';
import { DashboardPage } from '../pages/DashboardPage';
import { AppointmentModal } from '../pages/AppointmentModal';
import { PatientModal } from '../pages/PatientModal';

test.describe('Dashboard', () => {
  test('should display welcome greeting', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.expectLoaded();
  });

  test('should display stat cards', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await expect(dashboard.statCitasHoy).toBeVisible();
    await expect(dashboard.statPacientes).toBeVisible();
    await expect(dashboard.statRecordatorios).toBeVisible();
    await expect(dashboard.statSinPagar).toBeVisible();
    await expect(dashboard.statIngresos).toBeVisible();
  });

  test('should open appointment modal from new appointment button', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.newAppointmentButton.click();
    const modal = new AppointmentModal(authenticatedPage);
    await modal.waitForOpen();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should open patient modal from new patient button', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.newPatientButton.click();
    const modal = new PatientModal(authenticatedPage);
    await modal.waitForOpen();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should navigate to patients page via quick access', async ({ authenticatedPage }) => {
    await authenticatedPage.getByTestId('quick-access-patients').click();
    await expect(authenticatedPage).toHaveURL(/\/patients/);
  });

  test('should navigate to calendar via quick access', async ({ authenticatedPage }) => {
    await authenticatedPage.getByTestId('quick-access-calendar').click();
    await expect(authenticatedPage).toHaveURL(/\/calendar/);
  });

  test('should show empty state when no today appointments', async ({ authenticatedPage }) => {
    const emptyText = authenticatedPage.getByText(/No hay citas para hoy/i);
    const hasAppointments = await authenticatedPage.getByTestId('dashboard-today-appointment-card').count() > 0;
    if (!hasAppointments) {
      await expect(emptyText).toBeVisible();
    }
  });

  test('should show empty state when no active reminders', async ({ authenticatedPage }) => {
    const emptyText = authenticatedPage.getByText(/No hay recordatorios pendientes/i);
    const hasReminders = await authenticatedPage.getByTestId('dashboard-active-reminder-card').count() > 0;
    if (!hasReminders) {
      await expect(emptyText).toBeVisible();
    }
  });
});
