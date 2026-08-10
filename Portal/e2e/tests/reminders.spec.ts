import { test, expect } from '../fixtures';
import { RemindersPage } from '../pages/RemindersPage';
import { EditReminderModal } from '../pages/Modals/EditReminderModal';
import { CancelReminderModal } from '../pages/Modals/CancelReminderModal';
import {
  PATIENT_NAME,
  PATIENT_ID,
  APPT_DATE,
  APPT_TYPE_NAME,
  Routes,
} from '../utils/const';
import { futureDateTime, uniquePhoneNumber } from '../utils/test-data';
import { Channel, ReminderMode } from '@/src/types/Reminder';

test.skip('Reminders', () => {
  test('Create reminder', async ({ page, api }) => {
    await page.goto(Routes.REMINDERS);

    const remindersPage = new RemindersPage(page);
    const modal = await remindersPage.openCreateModal();

    const reminderId = await modal.createReminder({
      patientName: PATIENT_NAME,
      appointmentDateLabel: `${APPT_DATE} — ${APPT_TYPE_NAME}`,
    });

    await remindersPage.switchToActive();
    await remindersPage.expectReminderVisible(PATIENT_NAME);

    await api.deleteReminder(reminderId);
  });

  test('Cancel reminder from table', async ({ page, api }) => {
    await page.goto(Routes.REMINDERS);

    const reminder = await api.createReminder({
      channel: Channel.WHATSAPP,
      to: uniquePhoneNumber(),
      sendMode: ReminderMode.SCHEDULED,
      sendAt: futureDateTime(48),
      patientId: PATIENT_ID,
    });

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.expectReminderVisible(PATIENT_NAME);

    const cancelModal = await remindersPage.cancelReminder(PATIENT_NAME);
    await cancelModal.confirm();

    await remindersPage.expectReminderNotVisible(PATIENT_NAME);

    await api.deleteReminder(reminder.data.id);
  });

  test('Reschedule reminder from table', async ({ page, api }) => {
    await page.goto(Routes.REMINDERS);

    const reminder = await api.createReminder({
      channel: Channel.WHATSAPP,
      to: uniquePhoneNumber(),
      sendMode: ReminderMode.SCHEDULED,
      sendAt: futureDateTime(48),
      patientId: PATIENT_ID,
    });

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.expectReminderVisible(PATIENT_NAME);

    const editModal = await remindersPage.rescheduleReminder(PATIENT_NAME);
    await editModal.save();

    await remindersPage.expectReminderVisible(PATIENT_NAME);

    await api.deleteReminder(reminder.data.id);
  });

  test('Open drawer and reschedule from drawer', async ({ page, api }) => {
    await page.goto(Routes.REMINDERS);

    const reminder = await api.createReminder({
      channel: Channel.WHATSAPP,
      to: uniquePhoneNumber(),
      sendMode: ReminderMode.SCHEDULED,
      sendAt: futureDateTime(48),
      patientId: PATIENT_ID,
    });

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.expectReminderVisible(PATIENT_NAME);

    const drawer = await remindersPage.openDrawer(PATIENT_NAME);
    await drawer.waitForOpen();
    await drawer.expectSection('Paciente');
    await drawer.expectSection('Programación');
    await expect(drawer.panel.getByText(PATIENT_NAME)).toBeVisible();

    await drawer.reschedule();
    const editModal = new EditReminderModal(page);
    await editModal.save();

    await remindersPage.expectReminderVisible(PATIENT_NAME);

    await api.deleteReminder(reminder.data.id);
  });

  test('Cancel reminder from drawer', async ({ page, api }) => {
    await page.goto(Routes.REMINDERS);

    const reminder = await api.createReminder({
      channel: Channel.WHATSAPP,
      to: uniquePhoneNumber(),
      sendMode: ReminderMode.SCHEDULED,
      sendAt: futureDateTime(48),
      patientId: PATIENT_ID,
    });

    const remindersPage = new RemindersPage(page);
    await remindersPage.switchToActive();
    await remindersPage.expectReminderVisible(PATIENT_NAME);

    const drawer = await remindersPage.openDrawer(PATIENT_NAME);
    await drawer.waitForOpen();
    await expect(drawer.panel.getByText(PATIENT_NAME)).toBeVisible();

    await drawer.delete();
    const cancelModal = new CancelReminderModal(page);
    await cancelModal.confirm();

    await remindersPage.expectReminderNotVisible(PATIENT_NAME);

    await api.deleteReminder(reminder.data.id);
  });
});
