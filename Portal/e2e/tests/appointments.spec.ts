import { test, expect } from '../fixtures';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { AppointmentModal } from '../pages/Modals/AppointmentModal';
import { CancelAppointmentModal } from '../pages/Modals/CancelAppointmentModal';
import { AppointmentDrawer } from '../pages/Drawers/AppointmentDrawer';
import { SidebarPage } from '../pages/SidebarPage';
import {
  APPT_TYPE_NAME,
  APPT_TYPE_PRICE,
  LOCATION_NAME,
  PATIENT_NAME,
  PATIENT_LAST_NAME,
  PATIENT_EMAIL,
  Routes,
} from '../utils/const';
import { futureDateTime } from '../utils/test-data';

test.describe('Appointments', () => {
  test('Create appointment', async ({ page, api }) => {
    const patient = await api.createPatient({
      name: PATIENT_NAME,
      lastName: PATIENT_LAST_NAME,
      email: PATIENT_EMAIL,
    });
    const location = await api.createLocation({ name: LOCATION_NAME });
    const apptType = await api.createAppointmentType({
      name: APPT_TYPE_NAME,
      defaultPrice: Number(APPT_TYPE_PRICE),
    });

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    const modal = await appointmentsPage.openCreateModal();

    const appointmentId = await modal.createAppointment({
      patientName: PATIENT_NAME,
      typeName: APPT_TYPE_NAME,
      locationName: LOCATION_NAME,
      price: Number(APPT_TYPE_PRICE),
    });

    await appointmentsPage.searchAppointment(PATIENT_NAME);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    await api.deleteAppointment(appointmentId);
    await api.deletePatient(patient.data.id);
    await api.deleteLocation(location.data.id);
    await api.deleteAppointmentType(apptType.data.id);
  });

  test('Confirm and mark as paid', async ({ page, api }) => {
    const patient = await api.createPatient({
      name: PATIENT_NAME,
      lastName: PATIENT_LAST_NAME,
      email: PATIENT_EMAIL,
    });
    const location = await api.createLocation({ name: LOCATION_NAME });
    const apptType = await api.createAppointmentType({
      name: APPT_TYPE_NAME,
      defaultPrice: Number(APPT_TYPE_PRICE),
    });
    const appointment = await api.createAppointment({
      patientId: patient.data.id,
      locationId: location.data.id,
      typeId: apptType.data.id,
      startAt: futureDateTime(24),
      endAt: futureDateTime(25),
      status: 'SCHEDULED',
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    await appointmentsPage.confirmAppointment(PATIENT_NAME);
    await appointmentsPage.markAsPaid(PATIENT_NAME);

    await api.deleteAppointment(appointment.data.id);
    await api.deletePatient(patient.data.id);
    await api.deleteLocation(location.data.id);
    await api.deleteAppointmentType(apptType.data.id);
  });

  test('Cancel appointment from table', async ({ page, api }) => {
    const patient = await api.createPatient({
      name: PATIENT_NAME,
      lastName: PATIENT_LAST_NAME,
      email: PATIENT_EMAIL,
    });
    const location = await api.createLocation({ name: LOCATION_NAME });
    const apptType = await api.createAppointmentType({
      name: APPT_TYPE_NAME,
      defaultPrice: Number(APPT_TYPE_PRICE),
    });
    const appointment = await api.createAppointment({
      patientId: patient.data.id,
      locationId: location.data.id,
      typeId: apptType.data.id,
      startAt: futureDateTime(24),
      endAt: futureDateTime(25),
      status: 'SCHEDULED',
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    const cancelModal = await appointmentsPage.cancelAppointment(PATIENT_NAME);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(PATIENT_NAME);

    await api.deletePatient(patient.data.id);
    await api.deleteLocation(location.data.id);
    await api.deleteAppointmentType(apptType.data.id);
  });

  test('Open drawer and edit from drawer', async ({ page, api }) => {
    const patient = await api.createPatient({
      name: PATIENT_NAME,
      lastName: PATIENT_LAST_NAME,
      email: PATIENT_EMAIL,
    });
    const location = await api.createLocation({ name: LOCATION_NAME });
    const apptType = await api.createAppointmentType({
      name: APPT_TYPE_NAME,
      defaultPrice: Number(APPT_TYPE_PRICE),
    });
    const appointment = await api.createAppointment({
      patientId: patient.data.id,
      locationId: location.data.id,
      typeId: apptType.data.id,
      startAt: futureDateTime(24),
      endAt: futureDateTime(25),
      status: 'SCHEDULED',
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    const drawer = await appointmentsPage.openDrawer(PATIENT_NAME);
    await drawer.waitForOpen();
    await drawer.expectSection('Paciente');
    await drawer.expectSection('Fecha y Hora');
    await drawer.expectSection('Lugar');
    await drawer.expectSection('Pago');
    await expect(drawer.panel.getByText(PATIENT_NAME)).toBeVisible();
    await expect(drawer.panel.getByText(APPT_TYPE_NAME)).toBeVisible();
    await expect(drawer.panel.getByText(LOCATION_NAME)).toBeVisible();

    await drawer.edit();
    const editModal = new AppointmentModal(page);
    await editModal.waitForOpen();

    await editModal.next();
    await editModal.next();
    await editModal.setPrice(200000);
    await editModal.submit();
    await editModal.waitForClose();

    await api.deleteAppointment(appointment.data.id);
    await api.deletePatient(patient.data.id);
    await api.deleteLocation(location.data.id);
    await api.deleteAppointmentType(apptType.data.id);
  });

  test('Cancel appointment from drawer', async ({ page, api }) => {
    const patient = await api.createPatient({
      name: PATIENT_NAME,
      lastName: PATIENT_LAST_NAME,
      email: PATIENT_EMAIL,
    });
    const location = await api.createLocation({ name: LOCATION_NAME });
    const apptType = await api.createAppointmentType({
      name: APPT_TYPE_NAME,
      defaultPrice: Number(APPT_TYPE_PRICE),
    });
    const appointment = await api.createAppointment({
      patientId: patient.data.id,
      locationId: location.data.id,
      typeId: apptType.data.id,
      startAt: futureDateTime(24),
      endAt: futureDateTime(25),
      status: 'SCHEDULED',
      paid: false,
      price: Number(APPT_TYPE_PRICE),
    });

    await page.goto(Routes.APPOINTMENTS);

    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.expectAppointmentVisible(PATIENT_NAME);

    const drawer = await appointmentsPage.openDrawer(PATIENT_NAME);
    await drawer.waitForOpen();
    await expect(drawer.panel.getByText(PATIENT_NAME)).toBeVisible();

    await drawer.delete();
    const cancelModal = new CancelAppointmentModal(page);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(PATIENT_NAME);

    await api.deletePatient(patient.data.id);
    await api.deleteLocation(location.data.id);
    await api.deleteAppointmentType(apptType.data.id);
  });
});
