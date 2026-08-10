import { ReminderMode } from '@/src/types/Reminder';
import { test, expect } from '../fixtures';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { AppointmentModal } from '../pages/Modals/AppointmentModal';
import { CancelAppointmentModal } from '../pages/Modals/CancelAppointmentModal';
import {
  APPT_TYPE_NAME,
  APPT_TYPE_PRICE,
  LOCATION_NAME,
  PATIENT_NAME,
  Routes,
  PATIENT_ID,
  LOCATION_ID,
  APPT_TYPE_ID,
} from '../utils/const';
import { futureDateTime, randomNumber } from '../utils/test-data';

test.describe('Appointments', () => {
  test('Create appointment', async ({ page, api, trackedAppointments }) => {
    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    const modal = await appointmentsPage.openCreateModal();

    const appointmentId = await modal.createAppointment({
      patientName: PATIENT_NAME,
      typeName: APPT_TYPE_NAME,
      locationName: LOCATION_NAME,
      price: Number(APPT_TYPE_PRICE),
    });
    trackedAppointments.track(appointmentId)

    await appointmentsPage.searchAppointment(PATIENT_NAME);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    await api.deleteAppointment(appointmentId);
  });

  test('Confirm and mark as paid', async ({ page, api, trackedAppointments }) => {
    await page.goto(Routes.APPOINTMENTS);

    const appointment = await api.createAppointment({
      patientId: PATIENT_ID,
      locationId: LOCATION_ID,
      typeId: APPT_TYPE_ID,
      startAt: futureDateTime(24),
      endAt: futureDateTime(25),
      sendMode: ReminderMode.SCHEDULED,
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });
    trackedAppointments.track(appointment.data.id)


    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    await appointmentsPage.confirmAppointment(PATIENT_NAME);
    await appointmentsPage.markAsPaid(PATIENT_NAME);

    await api.deleteAppointment(appointment.data.id);
  });

  test('Cancel appointment from table', async ({ page, api, trackedAppointments }) => {
    await page.goto(Routes.APPOINTMENTS);

    const randomStartAt = randomNumber()
    const appointment = await api.createAppointment({
      patientId: PATIENT_ID,
      locationId: LOCATION_ID,
      typeId: APPT_TYPE_ID,
      startAt: futureDateTime(randomStartAt),
      endAt: futureDateTime(randomStartAt + 1),
      sendMode: ReminderMode.SCHEDULED,
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });
    trackedAppointments.track(appointment.data.id)

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    const cancelModal = await appointmentsPage.cancelAppointment(PATIENT_NAME);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(PATIENT_NAME);

    await api.deleteAppointment(appointment.data.id)
  });

  test('Open drawer and edit from drawer', async ({ page, api, trackedAppointments }) => {
    await page.goto(Routes.APPOINTMENTS);

    const randomStartAt = randomNumber()
    const appointment = await api.createAppointment({
      patientId: PATIENT_ID,
      locationId: LOCATION_ID,
      typeId: APPT_TYPE_ID,
      startAt: futureDateTime(randomStartAt),
      endAt: futureDateTime(randomStartAt + 1),
      sendMode: ReminderMode.SCHEDULED,
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });
    trackedAppointments.track(appointment.data.id)

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    const drawer = await appointmentsPage.openDrawer(PATIENT_NAME);
    await drawer.waitForOpen();
    await drawer.expectContent({
      patientName: PATIENT_NAME,
      typeName: APPT_TYPE_NAME,
      location: LOCATION_NAME,
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

  test('Cancel appointment from drawer', async ({ page, api, trackedAppointments }) => {
    await page.goto(Routes.APPOINTMENTS);

    const randomStartAt = randomNumber()
    const appointment = await api.createAppointment({
      patientId: PATIENT_ID,
      locationId: LOCATION_ID,
      typeId: APPT_TYPE_ID,
      startAt: futureDateTime(randomStartAt),
      endAt: futureDateTime(randomStartAt + 1),
      sendMode: ReminderMode.SCHEDULED,
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });
    trackedAppointments.track(appointment.data.id)

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    const drawer = await appointmentsPage.openDrawer(PATIENT_NAME);
    await drawer.waitForOpen();
    await expect(drawer.patientName).toContainText(PATIENT_NAME);

    await drawer.delete();
    const cancelModal = new CancelAppointmentModal(page);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(PATIENT_NAME);

    await api.deleteAppointment(appointment.data.id);
  });
});
