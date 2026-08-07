import { expect, Page, Locator } from '@playwright/test';

export class EditReminderModal {
  readonly page: Page;
  readonly panel: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('edit-reminder-modal-panel');
    this.saveButton = this.panel.getByTestId('edit-reminder-save-button');
    this.cancelButton = this.panel.getByTestId('edit-reminder-cancel-button');
  }

  async save() {
    await this.saveButton.click();
    await expect(this.panel).not.toBeVisible();
  }

  async cancel() {
    await this.cancelButton.click();
    await expect(this.panel).not.toBeVisible();
  }
}
