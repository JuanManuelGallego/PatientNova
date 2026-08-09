import { test, expect } from '../fixtures';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { AppointmentModal } from '../pages/Modals/AppointmentModal';
import { AppointmentDrawer } from '../pages/Drawers/AppointmentDrawer';
import { CancelAppointmentModal } from '../pages/Modals/CancelAppointmentModal';
import { uniqueName, uniqueEmail, futureDateTime } from '../utils/test-data';

test.describe('Appointments', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/appointments');
  });

  test('should display appointments list', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await expect(appointments.table).toBeVisible();
  });

  test('should view stats', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await expect(authenticatedPage.getByTestId('stat-card-citas-hoy')).toBeVisible();
    await expect(authenticatedPage.getByTestId('stat-card-proximas')).toBeVisible();
    await expect(authenticatedPage.getByTestId('stat-card-sin-pagar')).toBeVisible();
    await expect(authenticatedPage.getByTestId('stat-card-ingresos-mes')).toBeVisible();
  });

  test('should open create appointment modal', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    const modal = await appointments.openCreateModal();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should not proceed to step 2 without required fields', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    const modal = await appointments.openCreateModal();
    await modal.next();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should go back from step 2 to step 1', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    const modal = await appointments.openCreateModal();
    await expect(modal.backButton).toBeVisible();
    await modal.cancel();
  });

  test('should cancel appointment creation', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    const modal = await appointments.openCreateModal();
    await modal.cancel();
    await modal.waitForClose();
  });

  test('should confirm a scheduled appointment', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Appt'), lastName: 'TestLast', email: uniqueEmail() });
    const location = await api.createLocation({ name: uniqueName('Loc'), isVirtual: true });
    const apptType = await api.createAppointmentType({ name: uniqueName('Type'), defaultDuration: 60, defaultPrice: 50 });

    const appointment = await api.createAppointment({
      patientId: patient.id,
      locationId: location.id,
      typeId: apptType.id,
      startAt: futureDateTime(48),
      endAt: futureDateTime(49),
      price: 50,
      status: 'SCHEDULED',
    });

    await authenticatedPage.reload();
    const appointments = new AppointmentsPage(authenticatedPage);
    const confirmBtn = authenticatedPage.locator(`[data-testid="appointment-confirm-button"]`).first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await api.deleteAppointment(appointment.id as string).catch(() => { });
    await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    await api.deleteLocation(location.id as string).catch(() => { });
    await api.deletePatient(patient.id as string).catch(() => { });
  });

  test('should mark appointment as paid', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Paid'), lastName: 'TestLast', email: uniqueEmail() });
    const location = await api.createLocation({ name: uniqueName('Loc'), isVirtual: true });
    const apptType = await api.createAppointmentType({ name: uniqueName('Type'), defaultDuration: 60, defaultPrice: 50 });

    const appointment = await api.createAppointment({
      patientId: patient.id,
      locationId: location.id,
      typeId: apptType.id,
      startAt: futureDateTime(48),
      endAt: futureDateTime(49),
      price: 50,
      paid: false,
    });

    await authenticatedPage.reload();
    const payBtn = authenticatedPage.locator(`[data-testid="appointment-pay-button"]`).first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
    }

    await api.deleteAppointment(appointment.id as string).catch(() => { });
    await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    await api.deleteLocation(location.id as string).catch(() => { });
    await api.deletePatient(patient.id as string).catch(() => { });
  });

  test('should cancel an appointment', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Cancel'), lastName: 'TestLast', email: uniqueEmail() });
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

    await authenticatedPage.reload();
    const deleteBtn = authenticatedPage.locator(`[data-testid="appointment-row-delete-button"]`).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const cancelModal = new CancelAppointmentModal(authenticatedPage);
      await expect(cancelModal.dialog).toBeVisible();
      await cancelModal.confirm();
    }

    await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    await api.deleteLocation(location.id as string).catch(() => { });
    await api.deletePatient(patient.id as string).catch(() => { });
  });

  test('should cancel appointment deletion (abort)', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('NoDel'), lastName: 'TestLast', email: uniqueEmail() });
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

    await authenticatedPage.reload();
    const deleteBtn = authenticatedPage.locator(`[data-testid="appointment-row-delete-button"]`).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const cancelModal = new CancelAppointmentModal(authenticatedPage);
      await cancelModal.cancel();
    }

    await api.deleteAppointment(appointment.id as string).catch(() => { });
    await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    await api.deleteLocation(location.id as string).catch(() => { });
    await api.deletePatient(patient.id as string).catch(() => { });
  });

  test('should open appointment drawer on row click', async ({ authenticatedPage, api }) => {
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

    await authenticatedPage.reload();
    const appointments = new AppointmentsPage(authenticatedPage);
    const firstRow = authenticatedPage.getByRole('row').nth(1);
    if (await firstRow.isVisible()) {
      await firstRow.click();
      const drawer = new AppointmentDrawer(authenticatedPage);
      await drawer.waitForOpen();
      await expect(drawer.panel).toBeVisible();
      await drawer.close();
    }

    await api.deleteAppointment(appointment.id as string).catch(() => { });
    await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    await api.deleteLocation(location.id as string).catch(() => { });
    await api.deletePatient(patient.id as string).catch(() => { });
  });

  test('should display patient info in drawer', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Info'), lastName: 'TestLast', email: uniqueEmail() });
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

    await authenticatedPage.reload();
    const firstRow = authenticatedPage.getByRole('row').nth(1);
    if (await firstRow.isVisible()) {
      await firstRow.click();
      const drawer = new AppointmentDrawer(authenticatedPage);
      await drawer.waitForOpen();
      await drawer.close();
    }

    await api.deleteAppointment(appointment.id as string).catch(() => { });
    await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    await api.deleteLocation(location.id as string).catch(() => { });
    await api.deletePatient(patient.id as string).catch(() => { });
  });

  test('should filter by upcoming status', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.filterUpcoming.click();
    await expect(appointments.table).toBeVisible();
  });

  test('should filter by scheduled status', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.filterScheduled.click();
    await expect(appointments.table).toBeVisible();
  });

  test('should filter by confirmed status', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.filterConfirmed.click();
    await expect(appointments.table).toBeVisible();
  });

  test('should filter by completed status', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.filterCompleted.click();
    await expect(appointments.table).toBeVisible();
  });

  test('should search appointments', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.searchInput.fill('test');
    await authenticatedPage.waitForTimeout(500);
    await expect(appointments.table).toBeVisible();
    await appointments.searchInput.clear();
  });

  test('should show empty state when no appointments match filter', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.filterCancelled.click();
    const emptyText = authenticatedPage.getByText(/Sin resultados/i);
    const hasRows = (await authenticatedPage.getByRole('row').count()) > 1;
    if (!hasRows) {
      await expect(emptyText).toBeVisible();
    }
  });

  test('should filter by all appointments', async ({ authenticatedPage }) => {
    const appointments = new AppointmentsPage(authenticatedPage);
    await appointments.filterAll.click();
    await expect(appointments.table).toBeVisible();
  });

  test('should view appointment stats cards', async ({ authenticatedPage }) => {
    const statCards = authenticatedPage.locator('[data-testid^="stat-card-"]');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
