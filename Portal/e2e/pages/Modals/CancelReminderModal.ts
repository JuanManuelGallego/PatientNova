import { expect, Page, Locator } from '@playwright/test';

export class CancelReminderModal {
  readonly page: Page;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.confirmButton = this.page.getByTestId('cancel-reminder-confirm-button');
    this.cancelButton = this.page.getByTestId('cancel-reminder-cancel-button');
  }

  async confirm() {
    await this.confirmButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }
}
