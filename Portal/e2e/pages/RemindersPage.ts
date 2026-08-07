import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { ReminderModal } from './ReminderModal';
import { EditReminderModal } from './EditReminderModal';
import { CancelReminderModal } from './CancelReminderModal';
import { ReminderDrawer } from './ReminderDrawer';

export class RemindersPage extends BasePage {
  readonly createButton: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;
  readonly tabActive: Locator;
  readonly tabHistory: Locator;
  readonly tabBulk: Locator;
  readonly rescheduleTestId: string;
  readonly cancelTestId: string;
  readonly retryTestId: string;

  constructor(page: Page) {
    super(page);
    this.createButton = this.page.getByTestId('reminders-new-button');
    this.table = this.page.getByRole('table');
    this.searchInput = this.page.getByPlaceholder(/Buscar por nombre, número, canal/);
    this.tabActive = this.page.getByTestId('reminders-tab-active');
    this.tabHistory = this.page.getByTestId('reminders-tab-history');
    this.tabBulk = this.page.getByTestId('reminders-tab-bulk');
    this.rescheduleTestId = 'reminder-reschedule-button';
    this.cancelTestId = 'reminder-row-cancel-button';
    this.retryTestId = 'reminder-row-retry-button';
  }

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
    await row.locator(`[data-testid="${this.rescheduleTestId}"]`).click();
    const modal = new EditReminderModal(this.page);
    await expect(modal.panel).toBeVisible();
    return modal;
  }

  async cancelReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.locator(`[data-testid="${this.cancelTestId}"]`).click();
    const modal = new CancelReminderModal(this.page);
    await expect(modal.dialog).toBeVisible();
    return modal;
  }

  async retryReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.locator(`[data-testid="${this.retryTestId}"]`).click();
  }

  async expectReminderVisible(rowText: string) {
    await expect(this.table.getByRole('row').filter({ hasText: rowText })).toBeVisible();
  }
}
