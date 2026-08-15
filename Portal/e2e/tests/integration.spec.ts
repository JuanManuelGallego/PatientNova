import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages/SettingsPage';
import { PatientsPage } from '../pages/PatientsPage';
import { CalendarPage } from '../pages/CalendarPage';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { AppointmentModal } from '../pages/Modals/AppointmentModal';
import { RemindersPage } from '../pages/RemindersPage';
import { APPT_TYPE_DURATION, APPT_TYPE_PRICE, Routes } from '../utils/const';
import { uniqueName, uniqueEmail, uniquePhoneNumber, futureBusinessHourDateTime, addHours, randomString } from '../utils/test-data';
import { EntityType } from '@/src/types/AuditLog';
import { SidebarPage } from '../pages/SidebarPage';
import { Env } from '../utils/env';

test.describe('Appointment-Reminder lifecycle', () => {
  test('Create, update, and cancel appointment with reminder via UI', async ({
    page,
    trackedAppointments,
    trackedPatients,
    trackedReminders,
    trackedLocations,
    trackedAppointmentTypes,
    trackedBlockedTime,
  }) => {
    const locationName = uniqueName(EntityType.APPOINTMENT_LOCATION);
    const typeName = uniqueName(EntityType.APPOINTMENT_TYPE);
    const patientName = uniqueName(EntityType.PATIENT);
    const patientLastName = uniqueName(EntityType.PATIENT);
    const patientEmail = uniqueEmail();
    const patientPhone = uniquePhoneNumber();
    const blockDescription = uniqueName(EntityType.BLOCKED_TIME);
    const blockStart = futureBusinessHourDateTime();
    const blockEnd = addHours(blockStart, 1);
    const sidebar = new SidebarPage(page);

    // ── 1. Create Location via UI ──
    await page.goto(Routes.SETTINGS);
    const settings = new SettingsPage(page);
    const locationModal = await settings.openLocationModal();
    const locationId = await locationModal.create({
      name: locationName,
      address: randomString(),
      instructions: randomString()
    });
    trackedLocations.track(locationId);

    // ── 2. Create Appointment Type via UI ──
    const typeModal = await settings.openAppointmentTypeModal();
    const typeId = await typeModal.create({
      name: typeName,
      duration: APPT_TYPE_DURATION,
      price: APPT_TYPE_PRICE,
    });
    trackedAppointmentTypes.track(typeId);

    // ── 3. Create Patient via UI ──
    await sidebar.navigateToPatients()
    const patientsPage = new PatientsPage(page);
    const patientModal = await patientsPage.openCreateModal();
    const patientId = await patientModal.createPatient({
      name: patientName,
      lastName: patientLastName,
      email: patientEmail,
      whatsapp: patientPhone,
      appointmentType: typeName
    });
    trackedPatients.track(patientId);

    // ── 4. Create Blocked Time via UI ──
    await sidebar.navigateToCalendar()
    const calendar = new CalendarPage(page);
    const blockedTimeModal = await calendar.openBlockedTimeModal();
    const blockedTimeId = await blockedTimeModal.createBlockedTime({
      description: blockDescription,
      startTimeUtc: blockStart,
      endTimeUtc: blockEnd,
    });
    trackedBlockedTime.track(blockedTimeId);

    // ── 5. Create Appointment with Reminder via UI ──
    await sidebar.navigateToAppointments()
    const appointmentsPage = new AppointmentsPage(page);
    const createModal = await appointmentsPage.openCreateModal();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/appointments'),
    );

    await createModal.selectPatient(patientName);
    await createModal.selectType(typeName);
    await createModal.next();

    await createModal.selectLocation(locationName);
    await createModal.selectReminderType('1 hora antes');
    await createModal.next();

    await createModal.submit();

    const createResponse = await responsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const createdAppointment = await createResponse.json();
    const appointmentId = createdAppointment.data.id;
    trackedAppointments.track(appointmentId);

    const reminderId = createdAppointment.data.reminder?.id;
    if (reminderId) trackedReminders.track(reminderId);

    await appointmentsPage.searchAppointment(patientName);
    await appointmentsPage.expectAppointmentVisible(patientName);

    // ── 6. Verify Reminder was created ──
    await sidebar.navigateToReminders()
    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patientName);
    await remindersPage.expectReminderVisible(patientName);

    // ── 7. Update Appointment via UI (edit from drawer) ──
    await sidebar.navigateToAppointments()
    const drawer = await appointmentsPage.openDrawer(patientName);
    await drawer.waitForOpen();
    await drawer.edit();

    const editModal = new AppointmentModal(page);
    await editModal.waitForOpen();

    await editModal.selectType(Env.apptTypeName);
    await editModal.next();
    await editModal.next();

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/appointments/${appointmentId}`),
    );

    await editModal.submit();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok()).toBeTruthy();

    // ── 8. Verify Reminder still exists after update ──
    await sidebar.navigateToReminders()
    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patientName);
    await remindersPage.expectReminderVisible(patientName);

    // ── 9. Cancel Appointment via UI ──
    await sidebar.navigateToAppointments()
    const cancelModal = await appointmentsPage.cancelAppointment(patientName);
    await cancelModal.confirm();

    await appointmentsPage.expectAppointmentNotVisible(patientName);

    // ── 10. Verify Reminder is also cancelled ──
    await sidebar.navigateToReminders()
    await remindersPage.switchToHistory();
    await remindersPage.searchReminder(patientName);
    await remindersPage.expectReminderVisible(patientName);
  });
});
