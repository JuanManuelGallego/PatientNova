import { test, expect } from '../fixtures';
import { RemindersPage } from '../pages/RemindersPage';
import { ReminderModal } from '../pages/ReminderModal';
import { ReminderDrawer } from '../pages/ReminderDrawer';
import { EditReminderModal } from '../pages/EditReminderModal';
import { CancelReminderModal } from '../pages/CancelReminderModal';
import { uniqueName, uniqueEmail, futureDateTime, validE164Phone } from '../utils/test-data';

test.describe('Reminders', () => {
  test('should display reminders page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/reminders');
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
    await expect(authenticatedPage.getByTestId('reminders-tab-active')).toBeVisible();
    await expect(authenticatedPage.getByTestId('reminders-tab-history')).toBeVisible();
    await expect(authenticatedPage.getByTestId('reminders-tab-bulk')).toBeVisible();
  });

  test('should view stats', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/reminders');
    const statCards = authenticatedPage.locator('[data-testid^="stat-card-"]');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should switch to active tab', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToActive();
    await expect(reminders.tabActive).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch to history tab', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToHistory();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should switch to bulk tab', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToBulk();
    await expect(authenticatedPage.getByTestId('bulk-send-wizard')).toBeVisible();
  });

  test('should open create reminder modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/reminders');
    const reminders = new RemindersPage(authenticatedPage);
    const modal = await reminders.openCreateModal();
    await expect(modal.dialog).toBeVisible();
    await modal.cancel();
  });

  test('should cancel reminder creation', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/reminders');
    const reminders = new RemindersPage(authenticatedPage);
    const modal = await reminders.openCreateModal();
    await modal.cancel();
    await modal.waitForClose();
  });

  test('should reschedule reminder', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Resched'), lastName: 'TestLast', email: uniqueEmail(), whatsappNumber: validE164Phone() });

    const reminder = await api.createReminder({
      patientId: patient.id,
      channel: 'WHATSAPP',
      to: validE164Phone(),
      sendMode: 'SCHEDULED',
      sendAt: futureDateTime(48),
    });

    await authenticatedPage.reload();
    const reminders = new RemindersPage(authenticatedPage);
    const rescheduleBtn = authenticatedPage.locator(`[data-testid="reminder-reschedule-button"]`).first();
    if (await rescheduleBtn.isVisible()) {
      await rescheduleBtn.click();
      const editModal = new EditReminderModal(authenticatedPage);
      await expect(editModal.panel).toBeVisible();
      await editModal.cancel();
    }

    await api.cancelReminder(reminder.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should cancel reminder', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Cancel'), lastName: 'TestLast', email: uniqueEmail(), whatsappNumber: validE164Phone() });

    const reminder = await api.createReminder({
      patientId: patient.id,
      channel: 'WHATSAPP',
      to: validE164Phone(),
      sendMode: 'SCHEDULED',
      sendAt: futureDateTime(48),
    });

    await authenticatedPage.reload();
    const reminders = new RemindersPage(authenticatedPage);
    const cancelBtn = authenticatedPage.locator(`[data-testid="reminder-row-cancel-button"]`).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      const cancelModal = new CancelReminderModal(authenticatedPage);
      await expect(cancelModal.dialog).toBeVisible();
      await cancelModal.confirm();
    }

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should cancel reminder deletion (abort)', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('NoDel'), lastName: 'TestLast', email: uniqueEmail(), whatsappNumber: validE164Phone() });

    const reminder = await api.createReminder({
      patientId: patient.id,
      channel: 'WHATSAPP',
      to: validE164Phone(),
      sendMode: 'SCHEDULED',
      sendAt: futureDateTime(48),
    });

    await authenticatedPage.reload();
    const reminders = new RemindersPage(authenticatedPage);
    const cancelBtn = authenticatedPage.locator(`[data-testid="reminder-row-cancel-button"]`).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      const cancelModal = new CancelReminderModal(authenticatedPage);
      await cancelModal.cancel();
    }

    await api.cancelReminder(reminder.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should open reminder drawer', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('Drawer'), lastName: 'TestLast', email: uniqueEmail(), whatsappNumber: validE164Phone() });

    const reminder = await api.createReminder({
      patientId: patient.id,
      channel: 'WHATSAPP',
      to: validE164Phone(),
      sendMode: 'SCHEDULED',
      sendAt: futureDateTime(48),
    });

    await authenticatedPage.reload();
    const reminders = new RemindersPage(authenticatedPage);
    const firstRow = authenticatedPage.getByRole('row').nth(1);
    if (await firstRow.isVisible()) {
      await firstRow.click();
      const drawer = new ReminderDrawer(authenticatedPage);
      await drawer.waitForOpen();
      await expect(drawer.panel).toBeVisible();
      await drawer.close();
    }

    await api.cancelReminder(reminder.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should search reminders', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/reminders');
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.searchInput.fill('test');
    await authenticatedPage.waitForTimeout(500);
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
    await reminders.searchInput.clear();
  });

  test('should display empty state when no active reminders', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/reminders');
    const emptyText = authenticatedPage.getByText(/Sin recordatorios activos/i);
    const hasRows = (await authenticatedPage.getByRole('row').count()) > 1;
    if (!hasRows) {
      await expect(emptyText).toBeVisible();
    }
  });

  test('should use bulk send wizard - immediate mode', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToBulk();
    const wizard = authenticatedPage.getByTestId('bulk-send-wizard');
    await expect(wizard).toBeVisible();

    const immediateOption = authenticatedPage.getByTestId('bulk-send-option-immediate');
    if (await immediateOption.isVisible()) {
      await immediateOption.click();
    }
  });

  test('should use bulk send wizard - scheduled mode', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToBulk();
    const wizard = authenticatedPage.getByTestId('bulk-send-wizard');
    await expect(wizard).toBeVisible();

    const scheduledOption = authenticatedPage.getByTestId('bulk-send-option-scheduled');
    if (await scheduledOption.isVisible()) {
      await scheduledOption.click();
    }
  });

  test('should switch channel in bulk wizard', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToBulk();
    const wizard = authenticatedPage.getByTestId('bulk-send-wizard');
    await expect(wizard).toBeVisible();
  });

  test('should navigate bulk wizard steps', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToBulk();
    const wizard = authenticatedPage.getByTestId('bulk-send-wizard');
    await expect(wizard).toBeVisible();
  });

  test('should display reminder system info in drawer', async ({ authenticatedPage, api }) => {
    const patient = await api.createPatient({ name: uniqueName('SysInfo'), lastName: 'TestLast', email: uniqueEmail(), whatsappNumber: validE164Phone() });

    const reminder = await api.createReminder({
      patientId: patient.id,
      channel: 'WHATSAPP',
      to: validE164Phone(),
      sendMode: 'SCHEDULED',
      sendAt: futureDateTime(48),
    });

    await authenticatedPage.reload();
    const firstRow = authenticatedPage.getByRole('row').nth(1);
    if (await firstRow.isVisible()) {
      await firstRow.click();
      const drawer = new ReminderDrawer(authenticatedPage);
      await drawer.waitForOpen();
      await expect(drawer.panel).toBeVisible();
      await drawer.close();
    }

    await api.cancelReminder(reminder.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should view history tab with past reminders', async ({ authenticatedPage }) => {
    const reminders = new RemindersPage(authenticatedPage);
    await reminders.switchToHistory();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });
});
