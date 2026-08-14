import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { ReminderModal } from './Modals/ReminderModal';
import { EditReminderModal } from './Modals/EditReminderModal';
import { CancelReminderModal } from './Modals/CancelReminderModal';
import { ReminderDrawer } from './Drawers/ReminderDrawer';

export class RemindersPage extends BasePage {
  readonly createButton: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;
  readonly tabActive: Locator;
  readonly tabHistory: Locator;
  readonly tabBulk: Locator;

  constructor(page: Page) {
    super(page);
    this.createButton = this.page.getByTestId('reminders-new-button');
    this.table = this.page.getByRole('table');
    this.searchInput = this.page.getByTestId('reminders-search-input');
    this.tabActive = this.page.getByTestId('reminders-tab-active');
    this.tabHistory = this.page.getByTestId('reminders-tab-history');
    this.tabBulk = this.page.getByTestId('reminders-tab-bulk');
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
    await row.locator('[data-testid^="reminder-reschedule-button-"]').click();
    const modal = new EditReminderModal(this.page);
    await expect(modal.panel).toBeVisible();
    return modal;
  }

  async rescheduleReminderById(id: string) {
    await this.reminderRow(id).getByTestId(`reminder-reschedule-button-${id}`).click();
    const modal = new EditReminderModal(this.page);
    await expect(modal.panel).toBeVisible();
    return modal;
  }

  async cancelReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.locator('[data-testid^="reminder-row-cancel-button-"]').click();
    const modal = new CancelReminderModal(this.page);
    return modal;
  }

  async cancelReminderById(id: string) {
    await this.reminderRow(id).getByTestId(`reminder-row-cancel-button-${id}`).click();
    const modal = new CancelReminderModal(this.page);
    return modal;
  }

  async retryReminder(rowText: string) {
    const row = this.table.getByRole('row').filter({ hasText: rowText });
    await row.locator('[data-testid^="reminder-row-retry-button-"]').click();
  }

  async retryReminderById(id: string) {
    await this.reminderRow(id).getByTestId(`reminder-row-retry-button-${id}`).click();
  }

  async searchReminder(name: string) {
    await this.searchInput.fill(name);
  }

  async expectReminderVisible(rowText: string) {
    await expect(this.table.getByRole('row').filter({ hasText: rowText })).toBeVisible();
  }

  async expectReminderNotVisible(rowText: string) {
    await expect(this.table.getByRole('row').filter({ hasText: rowText })).not.toBeVisible();
  }

  reminderRow(id: string): Locator {
    return this.page.getByTestId(`reminder-row-${id}`);
  }

  async expectReminderVisibleById(id: string) {
    await expect(this.reminderRow(id)).toBeVisible();
  }

  async expectReminderNotVisibleById(id: string) {
    await expect(this.reminderRow(id)).not.toBeVisible();
  }
}
