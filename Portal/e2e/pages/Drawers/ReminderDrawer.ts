import { expect, Page, Locator } from '@playwright/test';

export class ReminderDrawer {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly rescheduleButton: Locator;
  readonly retryButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('reminder-drawer-panel');
    this.closeButton = page.getByTestId('reminder-drawer-close-button');
    this.rescheduleButton = this.panel.getByTestId('reminder-drawer-reschedule-button');
    this.retryButton = this.panel.getByTestId('reminder-drawer-retry-button');
    this.deleteButton = this.panel.getByTestId('reminder-drawer-cancel-button');
  }

  async waitForOpen() {
    await expect(this.panel).toBeVisible();
  }

  async waitForClose() {
    await expect(this.panel).not.toBeVisible();
  }

  async close() {
    await this.closeButton.click();
    await this.waitForClose();
  }

  async reschedule() {
    await this.rescheduleButton.click();
  }

  async retry() {
    await this.retryButton.click();
  }

  async delete() {
    await this.deleteButton.click();
  }

  async expectSection(title: string) {
    await expect(this.panel.getByText(title)).toBeVisible();
  }
}
