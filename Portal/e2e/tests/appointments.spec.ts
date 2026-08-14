import { test, expect } from '../fixtures';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { AppointmentModal } from '../pages/Modals/AppointmentModal';
import { CancelAppointmentModal } from '../pages/Modals/CancelAppointmentModal';
import { APPT_TYPE_PRICE, Routes } from '../utils/const';
import { Env } from '../utils/env';
import { createTestPatient, createTestAppointment } from '../utils/helpers';

test.describe('Appointments', () => {
  test('Create appointment', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    const modal = await appointmentsPage.openCreateModal();

    const appointmentId = await modal.createAppointment({
      patientName: patient.name,
      typeName: Env.apptTypeName,
      locationName: Env.locationName,
      price: Number(APPT_TYPE_PRICE),
    });
    trackedAppointments.track(appointmentId);

    await appointmentsPage.searchAppointment(patient.name);
    await appointmentsPage.expectAppointmentVisible(patient.name);

    await api.deleteAppointment(appointmentId);
  });

  test('Confirm and mark as paid', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const appointment = await createTestAppointment(api, patient.id);
    trackedAppointments.track(appointment.data.id);

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(patient.name);

    await appointmentsPage.confirmAppointment(patient.name);
    await appointmentsPage.markAsPaid(patient.name);

    await api.deleteAppointment(appointment.data.id);
  });

  test('Cancel appointment from table', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const appointment = await createTestAppointment(api, patient.id);
    trackedAppointments.track(appointment.data.id);

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(patient.name);

    const cancelModal = await appointmentsPage.cancelAppointment(patient.name);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(patient.name);

    await api.deleteAppointment(appointment.data.id);
  });

  test('Open drawer and edit from drawer', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const appointment = await createTestAppointment(api, patient.id);
    trackedAppointments.track(appointment.data.id);

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(patient.name);

    const drawer = await appointmentsPage.openDrawer(patient.name);
    await drawer.waitForOpen();
    await drawer.expectContent({
      patientName: patient.name,
      typeName: Env.apptTypeName,
      location: Env.locationName,
    });

    await drawer.edit();
    const editModal = new AppointmentModal(page);
    await editModal.waitForOpen();

    await editModal.next();
    await editModal.next();
    await editModal.setPrice(200000);
    await editModal.submit();
    await editModal.waitForClose();

    await api.deleteAppointment(appointment.data.id);
  });

  test('Cancel appointment from drawer', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const appointment = await createTestAppointment(api, patient.id);
    trackedAppointments.track(appointment.data.id);

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(patient.name);

    const drawer = await appointmentsPage.openDrawer(patient.name);
    await drawer.waitForOpen();
    await expect(drawer.patientName).toContainText(patient.name);

    await drawer.delete();
    const cancelModal = new CancelAppointmentModal(page);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(patient.name);

    await api.deleteAppointment(appointment.data.id);
  });
});
