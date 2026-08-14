import { test, expect } from '../fixtures';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { AppointmentModal } from '../pages/Modals/AppointmentModal';
import { CancelAppointmentModal } from '../pages/Modals/CancelAppointmentModal';
import { HttpMethods, APPT_TYPE_PRICE, Routes } from '../utils/const';
import { Env } from '../utils/env';
import { createTestPatient, createTestAppointment } from '../utils/helpers';
import { futureDateTime, addHours, futureDate } from '../utils/test-data';

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

    await appointmentsPage.expectAppointmentRowVisible(appointmentId);

    const appt = await api.getAppointment(appointmentId);
    expect(appt.data.id).toBe(appointmentId);
    expect(appt.data.patientId).toBe(patient.id);
    expect(appt.data.typeId).toBe(Env.apptTypeId);
    expect(appt.data.locationId).toBe(Env.locationId);
    expect(appt.data.price).toBe(Number(APPT_TYPE_PRICE));
    expect(appt.data.status).toBe('SCHEDULED');
    expect(appt.data.paid).toBe(false);

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

    await appointmentsPage.confirmAppointmentById(appointment.data.id);
    await expect(page.getByTestId(`appointment-confirm-button-${appointment.data.id}`)).not.toBeVisible();

    await appointmentsPage.markAsPaidById(appointment.data.id);
    await expect(page.getByTestId(`appointment-pay-button-${appointment.data.id}`)).not.toBeVisible();

    const appt = await api.getAppointment(appointment.data.id);
    expect(appt.data.status).toBe('CONFIRMED');
    expect(appt.data.paid).toBe(true);

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

    const appt = await api.getAppointment(appointment.data.id);
    expect(appt.data.status).toBe('CANCELLED');

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

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.PATCH &&
        response.url().includes(`/appointments/${appointment.data.id}`),
    );
    await editModal.submit();
    await editModal.waitForClose();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe(appointment.data.id);

    const appt = await api.getAppointment(appointment.data.id);
    expect(appt.data.price).toBe(200000);

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

    const appt = await api.getAppointment(appointment.data.id);
    expect(appt.data.status).toBe('CANCELLED');

    await api.deleteAppointment(appointment.data.id);
  });
});

test.describe('Appointment Filters, Pagination, Validation, Conflicts, and Virtual Meetings', () => {
  const FUTURE_OFFSETS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  async function createAppointmentForStatus(
    api: any,
    trackedAppointments: { track: (id: string) => void },
    patientId: string,
    status: string,
    offset: number,
  ): Promise<string> {
    const startAt = futureDateTime(offset);
    const endAt = addHours(startAt, 1);
    const appt = await api.createAppointment({
      patientId,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt,
      endAt,
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(appt.data.id);
    if (status !== 'SCHEDULED') {
      await api.patch(`/appointments/${appt.data.id}`, { status });
    }
    return appt.data.id;
  }

  function appointmentsEndpointMatches(url: string, params: Record<string, string | null>): boolean {
    if (!url.includes('/appointments')) return false;
    const sp = new URL(url).searchParams;
    return Object.entries(params).every(([k, v]) =>
      v === null ? !sp.has(k) : sp.get(k) === v,
    );
  }

  test('Filter by status', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const statuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    for (let i = 0; i < statuses.length; i++) {
      await createAppointmentForStatus(api, trackedAppointments, patient.id, statuses[i], FUTURE_OFFSETS[i]);
    }

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);

    await appts.searchAppointment(patient.name);
    await page.waitForResponse(
      (r) => appointmentsEndpointMatches(r.url(), { search: patient.name }),
    );

    const filterKey: Record<string, string> = {
      SCHEDULED: 'scheduled',
      CONFIRMED: 'confirmed',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      NO_SHOW: 'no_show',
    };

    for (const status of statuses) {
      const responsePromise = page.waitForResponse((r) =>
        appointmentsEndpointMatches(r.url(), { status, search: patient.name }),
      );
      await appts.filterBy(filterKey[status]);
      await responsePromise;
      await expect(
        appts.table.locator('tbody tr').filter({ hasText: patient.name }),
      ).toHaveCount(1);
    }
  });

  test('Filter by paid status', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const paidAppt = await api.createAppointment({
      patientId: patient.id,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt: futureDateTime(FUTURE_OFFSETS[0]),
      endAt: addHours(futureDateTime(FUTURE_OFFSETS[0]), 1),
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(paidAppt.data.id);
    await api.patch(`/appointments/${paidAppt.data.id}`, { paid: true });

    const unpaidAppt = await api.createAppointment({
      patientId: patient.id,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt: futureDateTime(FUTURE_OFFSETS[1]),
      endAt: addHours(futureDateTime(FUTURE_OFFSETS[1]), 1),
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(unpaidAppt.data.id);

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);

    await appts.searchAppointment(patient.name);
    await page.waitForResponse(
      (r) => appointmentsEndpointMatches(r.url(), { search: patient.name }),
    );

    const rows = () => appts.table.locator('tbody tr').filter({ hasText: patient.name });

    let responsePromise = page.waitForResponse((r) =>
      appointmentsEndpointMatches(r.url(), { paid: 'true', search: patient.name }),
    );
    await appts.setPaidFilter('true');
    await responsePromise;
    await expect(rows()).toHaveCount(1);

    responsePromise = page.waitForResponse((r) =>
      appointmentsEndpointMatches(r.url(), { paid: 'false', search: patient.name }),
    );
    await appts.setPaidFilter('false');
    await responsePromise;
    await expect(rows()).toHaveCount(1);

    responsePromise = page.waitForResponse((r) =>
      appointmentsEndpointMatches(r.url(), { paid: null, search: patient.name }),
    );
    await appts.setPaidFilter('All');
    await responsePromise;
    await expect(rows()).toHaveCount(2);
  });

  test('Search by patient name', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const appt = await api.createAppointment({
      patientId: patient.id,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt: futureDateTime(FUTURE_OFFSETS[0]),
      endAt: addHours(futureDateTime(FUTURE_OFFSETS[0]), 1),
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(appt.data.id);

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);

    const responsePromise = page.waitForResponse((r) =>
      appointmentsEndpointMatches(r.url(), { search: patient.name }),
    );
    await appts.searchAppointment(patient.name);
    await responsePromise;

    await expect(
      appts.table.locator('tbody tr').filter({ hasText: patient.name }),
    ).toHaveCount(1);
  });

  test('Filter by date', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const startAt = futureDate(2);
    const appt = await api.createAppointment({
      patientId: patient.id,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt,
      endAt: addHours(startAt, 1),
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(appt.data.id);

    const otherStart = futureDate(10);
    const otherAppt = await api.createAppointment({
      patientId: patient.id,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt: otherStart,
      endAt: addHours(otherStart, 1),
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(otherAppt.data.id);

    const dateStr = startAt.slice(0, 10);

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);

    const responsePromise = page.waitForResponse((r) =>
      appointmentsEndpointMatches(r.url(), {
        dateFrom: `${dateStr}T00:00:00.000Z`,
        dateTo: `${dateStr}T23:59:59.999Z`,
      }),
    );
    await appts.setDateFilter(dateStr);
    await responsePromise;

    await expect(
      appts.table.locator('tbody tr').filter({ hasText: patient.name }),
    ).toHaveCount(1);
  });

  test('Paginate appointments', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const prefix = `PagAppt-${Date.now().toString(36)}`;
    for (let i = 0; i < 11; i++) {
      const name = `${prefix}-${String(i).padStart(2, '0')}`;
      const patient = await createTestPatient(api, { name, lastName: name });
      trackedPatients.track(patient.id);
      const startAt = futureDateTime(FUTURE_OFFSETS[0] + i);
      const appt = await api.createAppointment({
        patientId: patient.id,
        locationId: Env.locationId,
        typeId: Env.apptTypeId,
        startAt,
        endAt: addHours(startAt, 1),
        price: 100000,
        status: 'SCHEDULED',
      });
      trackedAppointments.track(appt.data.id);
    }

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);

    await appts.searchAppointment(prefix);
    await page.waitForResponse(
      (r) => appointmentsEndpointMatches(r.url(), { search: prefix }),
    );

    await expect(appts.table.locator('tbody tr')).toHaveCount(10);
    await expect(page.locator('.table-footer')).toContainText('de 11 citas');

    let responsePromise = page.waitForResponse(
      (r) => r.url().includes('/appointments') && new URL(r.url()).searchParams.get('page') === '2',
    );
    await appts.goToNextPage();
    await responsePromise;
    await expect(appts.table.locator('tbody tr')).toHaveCount(1);

    responsePromise = page.waitForResponse(
      (r) => r.url().includes('/appointments') && new URL(r.url()).searchParams.get('page') === '1',
    );
    await appts.goToPreviousPage();
    await responsePromise;
    await expect(appts.table.locator('tbody tr')).toHaveCount(10);
  });

  test('Appointment overlap returns 409', async ({ page, api, trackedAppointments, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    const startA = tomorrow.toISOString();
    const endA = addHours(startA, 1);

    const apptA = await api.createAppointment({
      patientId: patient.id,
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt: startA,
      endAt: endA,
      price: 100000,
      status: 'SCHEDULED',
    });
    trackedAppointments.track(apptA.data.id);

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);
    const modal = await appts.openCreateModal();

    await modal.selectPatient(patient.name);
    await modal.selectType(Env.apptTypeName);
    await modal.next();
    await modal.selectLocation(Env.locationName);
    await modal.next();

    const responsePromise = page.waitForResponse(
      (r) => r.request().method() === HttpMethods.POST && r.url().includes('/appointments'),
    );
    await modal.submit();
    const response = await responsePromise;

    expect(response.status()).toBe(409);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('conflict');

    await modal.waitForOpen();
    await expect(modal.error).toContainText('conflict');
  });

  test('Virtual meeting URL is persisted and rendered', async ({ page, api, trackedAppointments, trackedPatients, trackedLocations }) => {
    const locName = `VirtLoc-${Date.now().toString(36)}`;
    const location = await api.createLocation({ name: locName, isVirtual: true });
    trackedLocations.track(location.data.id);

    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    await page.goto(Routes.APPOINTMENTS);
    const appts = new AppointmentsPage(page);
    const modal = await appts.openCreateModal();

    await modal.selectPatient(patient.name);
    await modal.selectType(Env.apptTypeName);
    await modal.next();
    await modal.selectLocation(locName);
    await modal.setMeetingUrl('https://meet.google.com/test-room');
    await modal.next();

    const responsePromise = page.waitForResponse(
      (r) => r.request().method() === HttpMethods.POST && r.url().includes('/appointments'),
    );
    await modal.submit();
    const response = await responsePromise;

    expect(response.status()).toBe(201);
    const json = (await response.json()) as { data: { id: string; meetingUrl: string } };
    expect(json.data.meetingUrl).toBe('https://meet.google.com/test-room');

    const id = json.data.id;
    trackedAppointments.track(id);

    await appts.expectAppointmentRowVisible(id);

    const tableLink = page.getByTestId(`appointment-table-virtual-link-${id}`);
    await expect(tableLink).toBeVisible();
    expect(await tableLink.getAttribute('href')).toBe('https://meet.google.com/test-room');

    const drawer = await appts.openDrawerById(id);
    await drawer.waitForOpen();
    const drawerLink = page.getByTestId('appointment-drawer-meeting-link');
    await expect(drawerLink).toBeVisible();
    expect(await drawerLink.getAttribute('href')).toBe('https://meet.google.com/test-room');
  });
});
