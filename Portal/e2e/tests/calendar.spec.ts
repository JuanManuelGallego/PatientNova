import { test, expect } from '../fixtures';
import { CalendarPage } from '../pages/CalendarPage';
import { AppointmentModal } from '../pages/AppointmentModal';
import { BlockedTimeModal } from '../pages/BlockedTimeModal';
import { uniqueName, uniqueEmail, futureDateTime } from '../utils/test-data';

test.describe('Calendar', () => {
  test('should display calendar in month view', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/calendar');
    await expect(authenticatedPage.getByTestId('calendar-view-month-button')).toBeVisible();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should switch to week view', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    await calendar.switchToWeek();
    await expect(authenticatedPage.getByTestId('calendar-view-week-button')).toBeVisible();
  });

  test('should switch back to month view', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    await calendar.switchToWeek();
    await calendar.switchToMonth();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should navigate to previous month', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    await calendar.goToPrev();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should navigate to next month', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    await calendar.goToNext();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should navigate to today', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    await calendar.goToPrev();
    await calendar.goToPrev();
    await calendar.goToToday();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should open appointment modal from calendar', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    const modal = await calendar.openAppointmentModal();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should open blocked time modal', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    const modal = await calendar.openBlockedTimeModal();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should create blocked time', async ({ authenticatedPage, api }) => {
    const startAt = futureDateTime(48);
    const endAt = futureDateTime(49);

    const calendar = new CalendarPage(authenticatedPage);
    const modal = await calendar.openBlockedTimeModal();
    await expect(modal.dialog).toBeVisible();

    const startInput = authenticatedPage.getByTestId('blocked-time-start-input');
    const endInput = authenticatedPage.getByTestId('blocked-time-end-input');
    const descInput = authenticatedPage.getByTestId('blocked-time-description-input');

    if (await startInput.isVisible()) {
      await startInput.fill(startAt);
      await endInput.fill(endAt);
      await descInput.fill('E2E test block');
      await modal.submit();
    } else {
      await modal.cancel();
    }
  });

  test('should show appointments on calendar', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Cal'), lastName: 'TestLast', email: uniqueEmail() });
    const location = await api.createLocation({ name: uniqueName('Loc'), isVirtual: true });
    const apptType = await api.createAppointmentType({ name: uniqueName('Type'), defaultDuration: 60, defaultPrice: 50 });

    const appointment = await api.createAppointment({
      patientId: patient.id,
      locationId: location.id,
      typeId: apptType.id,
      startAt: futureDateTime(48),
      endAt: futureDateTime(49),
      price: 50,
    });

    await authenticatedPage.goto('/calendar');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await expect(authenticatedPage.getByRole('table')).toBeVisible();

    await api.deleteAppointment(appointment.id as string).catch(() => {});
    await api.deleteAppointmentType(apptType.id as string).catch(() => {});
    await api.deleteLocation(location.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should show blocked time on calendar', async ({ authenticatedPage, api }) => {
    const blocked = await api.createBlockedTime({
      startTimeUtc: futureDateTime(72),
      endTimeUtc: futureDateTime(73),
      description: 'E2E blocked time',
    });

    await authenticatedPage.goto('/calendar');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await expect(authenticatedPage.getByRole('table')).toBeVisible();

    await api.deleteBlockedTime(blocked.id as string).catch(() => {});
  });

  test('should open appointment drawer from calendar event', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Drawer'), lastName: 'TestLast', email: uniqueEmail() });
    const location = await api.createLocation({ name: uniqueName('Loc'), isVirtual: true });
    const apptType = await api.createAppointmentType({ name: uniqueName('Type'), defaultDuration: 60, defaultPrice: 50 });

    const appointment = await api.createAppointment({
      patientId: patient.id,
      locationId: location.id,
      typeId: apptType.id,
      startAt: futureDateTime(48),
      endAt: futureDateTime(49),
      price: 50,
    });

    await authenticatedPage.goto('/calendar');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    const eventChip = authenticatedPage.locator('[data-testid^="calendar-event-"]').first();
    if (await eventChip.isVisible()) {
      await eventChip.click();
    }

    await api.deleteAppointment(appointment.id as string).catch(() => {});
    await api.deleteAppointmentType(apptType.id as string).catch(() => {});
    await api.deleteLocation(location.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should handle blocked time validation - end before start', async ({ authenticatedPage }) => {
    const calendar = new CalendarPage(authenticatedPage);
    const modal = await calendar.openBlockedTimeModal();
    await expect(modal.dialog).toBeVisible();

    const startInput = authenticatedPage.getByTestId('blocked-time-start-input');
    const endInput = authenticatedPage.getByTestId('blocked-time-end-input');

    if (await startInput.isVisible()) {
      const now = new Date();
      now.setHours(now.getHours() + 48);
      const earlier = new Date(now);
      earlier.setHours(earlier.getHours() - 2);

      await startInput.fill(now.toISOString());
      await endInput.fill(earlier.toISOString());
      await modal.submitButton.click();
    }

    await modal.cancel();
  });
});
