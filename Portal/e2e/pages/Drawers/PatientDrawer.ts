import { expect, Page, Locator } from '@playwright/test';

export class PatientDrawer {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('patient-drawer-panel');
    this.closeButton = page.getByTestId('patient-drawer-close-button');
    this.editButton = this.panel.getByTestId('patient-drawer-edit-button');
    this.deleteButton = this.panel.getByTestId('patient-drawer-delete-button');
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

  async delete() {
    await this.deleteButton.click();
  }

  async expectSection(title: string) {
    await expect(this.panel.getByText(title)).toBeVisible();
  }
}
