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
    this.panel = page.locator('.drawer-panel');
    this.closeButton = page.locator('.drawer-panel .btn-close--transparent');
    this.rescheduleButton = this.panel.getByRole('button', { name: 'Reprogramar' });
    this.retryButton = this.panel.getByRole('button', { name: /Reintentar/ });
    this.deleteButton = this.panel.locator('.btn-drawer-delete');
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
