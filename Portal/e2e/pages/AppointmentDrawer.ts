import { expect, Page, Locator } from '@playwright/test';

export class AppointmentDrawer {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly editButton: Locator;
  readonly payButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('appointment-drawer-panel');
    this.closeButton = page.getByTestId('appointment-drawer-close-button');
    this.editButton = this.panel.getByTestId('appointment-drawer-edit-button');
    this.payButton = this.panel.getByTestId('appointment-drawer-pay-button');
    this.deleteButton = this.panel.getByTestId('appointment-drawer-delete-button');
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

  async edit() {
    await this.editButton.click();
  }

  async markAsPaid() {
    await this.payButton.click();
  }

  async delete() {
    await this.deleteButton.click();
  }

  async expectSection(title: string) {
    await expect(this.panel.getByText(title)).toBeVisible();
  }
}
