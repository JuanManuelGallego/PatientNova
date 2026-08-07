import { BasePage } from './BasePage';
import { expect, Page } from '@playwright/test';
import { ReminderModal } from './ReminderModal';
import { EditReminderModal } from './EditReminderModal';
import { CancelReminderModal } from './CancelReminderModal';
import { ReminderDrawer } from './ReminderDrawer';

export class RemindersPage extends BasePage {
  readonly createButton = this.page.getByRole('button', { name: 'Nuevo Recordatorio' });
  readonly table = this.page.getByRole('table');
  readonly searchInput = this.page.getByPlaceholder(/Buscar por nombre, número, canal/);

  readonly tabActive = this.page.getByRole('button', { name: 'Activos' });
  readonly tabHistory = this.page.getByRole('button', { name: 'Historial' });
  readonly tabBulk = this.page.getByRole('button', { name: 'Envío Masivo' });

  async openCreateModal() {
    await this.createButton.click();
    const modal = new ReminderModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async switchToActive() {
    await this.tabActive.click();
  }

  async switchToHistory() {
    await this.tabHistory.click();
  }

  async switchToBulk() {
    await this.tabBulk.click();
  }

  async openDrawer(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.click();
    const drawer = new ReminderDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }

  async rescheduleReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.getByRole('button', { name: /Reprogramar/ }).click();
    const modal = new EditReminderModal(this.page);
    await expect(modal.panel).toBeVisible();
    return modal;
  }

  async cancelReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.locator('.btn-action-delete').click();
    const modal = new CancelReminderModal(this.page);
    await expect(modal.dialog).toBeVisible();
    return modal;
  }

  async retryReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.locator('.btn-action-edit').click();
  }

  async expectReminderVisible(rowText: string) {
    await expect(this.table.getByRole('row').filter({ hasText: rowText })).toBeVisible();
  }
}
