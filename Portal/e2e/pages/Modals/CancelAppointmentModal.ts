import { expect, Page, Locator } from '@playwright/test';

export class CancelAppointmentModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('cancel-appointment-dialog');
    this.confirmButton = this.dialog.getByTestId('cancel-appointment-confirm-button');
    this.cancelButton = this.dialog.getByTestId('cancel-appointment-cancel-button');
  }

  async confirm() {
    await this.confirmButton.click();
    await expect(this.dialog).not.toBeVisible();
  }

  async cancel() {
    await this.cancelButton.click();
    await expect(this.dialog).not.toBeVisible();
  }
}
