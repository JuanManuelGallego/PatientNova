import { expect, Page, Locator } from '@playwright/test';

export class DeleteAppointmentTypeModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('delete-appointment-type-dialog');
    this.confirmButton = this.dialog.getByTestId('delete-appointment-type-dialog-confirm-button');
    this.cancelButton = this.dialog.getByTestId('delete-appointment-type-dialog-cancel-button');
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
