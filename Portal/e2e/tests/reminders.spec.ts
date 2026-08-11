import { test, expect } from '../fixtures';
import { RemindersPage } from '../pages/RemindersPage';
import { EditReminderModal } from '../pages/Modals/EditReminderModal';
import { CancelReminderModal } from '../pages/Modals/CancelReminderModal';
import { APPT_DATE, APPT_TYPE_NAME, Routes } from '../utils/const';
import { createTestPatient, createTestReminder } from '../utils/helpers';
import { uniquePhoneNumber } from '../utils/test-data';
import { ReminderMode } from '@/src/types/Reminder';

test.describe('Reminders', () => {
  test('Create reminder', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api, { whatsappNumber: uniquePhoneNumber() });
    trackedPatients.track(patient.id);

    await page.goto(Routes.REMINDERS);

    const remindersPage = new RemindersPage(page);
    const modal = await remindersPage.openCreateModal();

    const reminderId = await modal.createReminder({
      patientName: patient.name,
      sendMode: ReminderMode.SCHEDULED
    });

    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patient.name);
    await remindersPage.expectReminderVisible(patient.name);

    await api.deleteReminder(reminderId);
  });

  test('Cancel reminder from table', async ({ page, api, trackedPatients, trackedReminders }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const reminder = await createTestReminder(api, patient.id);
    trackedReminders.track(reminder.data.id);

    await page.goto(Routes.REMINDERS);

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patient.name);
    await remindersPage.expectReminderVisible(patient.name);

    const cancelModal = await remindersPage.cancelReminder(patient.name);
    await cancelModal.confirm();

    await remindersPage.expectReminderNotVisible(patient.name);

    await api.deleteReminder(reminder.data.id);
  });

  test('Reschedule reminder from table', async ({ page, api, trackedPatients, trackedReminders }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const reminder = await createTestReminder(api, patient.id);
    trackedReminders.track(reminder.data.id);

    await page.goto(Routes.REMINDERS);

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patient.name);
    await remindersPage.expectReminderVisible(patient.name);

    const editModal = await remindersPage.rescheduleReminder(patient.name);
    await editModal.save();

    await remindersPage.expectReminderVisible(patient.name);

    await api.deleteReminder(reminder.data.id);
  });

  test('Open drawer and reschedule from drawer', async ({ page, api, trackedPatients, trackedReminders }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const reminder = await createTestReminder(api, patient.id);
    trackedReminders.track(reminder.data.id);

    await page.goto(Routes.REMINDERS);

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patient.name);
    await remindersPage.expectReminderVisible(patient.name);

    const drawer = await remindersPage.openDrawer(patient.name);
    await drawer.waitForOpen();
    await drawer.expectSection('Paciente');
    await drawer.expectSection('Programación');
    await expect(drawer.panel.getByText(patient.name)).toBeVisible();

    await drawer.reschedule();
    const editModal = new EditReminderModal(page);
    await editModal.save();

    await remindersPage.expectReminderVisible(patient.name);

    await api.deleteReminder(reminder.data.id);
  });

  test('Cancel reminder from drawer', async ({ page, api, trackedPatients, trackedReminders }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const reminder = await createTestReminder(api, patient.id);
    trackedReminders.track(reminder.data.id);

    await page.goto(Routes.REMINDERS);

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.searchReminder(patient.name);
    await remindersPage.expectReminderVisible(patient.name);

    const drawer = await remindersPage.openDrawer(patient.name);
    await drawer.waitForOpen();
    await expect(drawer.panel.getByText(patient.name)).toBeVisible();

    await drawer.delete();
    const cancelModal = new CancelReminderModal(page);
    await cancelModal.confirm();

    await remindersPage.expectReminderNotVisible(patient.name);

    await api.deleteReminder(reminder.data.id);
  });
});
