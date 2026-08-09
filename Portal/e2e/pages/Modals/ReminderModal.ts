import { expect, Page, Locator } from '@playwright/test';

export class ReminderModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('reminder-modal-dialog');
    this.nextButton = this.dialog.getByTestId('reminder-modal-next-button');
    this.backButton = this.dialog.getByTestId('reminder-modal-back-button');
    this.submitButton = this.dialog.getByTestId('reminder-modal-submit-button');
    this.closeButton = this.dialog.getByTestId('reminder-modal-close-button');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async next() {
    await this.nextButton.click();
  }

  async back() {
    await this.backButton.click();
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.closeButton.click();
    await this.waitForClose();
  }
}
