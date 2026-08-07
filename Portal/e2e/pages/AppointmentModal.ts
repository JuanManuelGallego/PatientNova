import { expect, Page, Locator } from '@playwright/test';

export class AppointmentModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('appointment-modal-dialog');
    this.submitButton = this.dialog.getByTestId('appointment-modal-submit-button');
    this.nextButton = this.dialog.getByTestId('appointment-modal-next-button');
    this.backButton = this.dialog.getByTestId('appointment-modal-back-button');
    this.closeButton = this.dialog.getByTestId('appointment-modal-close-button');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async submit() {
    await this.submitButton.click();
  }

  async next() {
    await this.nextButton.click();
  }

  async back() {
    await this.backButton.click();
  }

  async cancel() {
    await this.closeButton.click();
    await this.waitForClose();
  }
}
