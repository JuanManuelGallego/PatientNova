import { expect, Page, Locator } from '@playwright/test';

export class BulkSendWizard {
  readonly page: Page;
  readonly dialog: Locator;
  readonly immediateOption: Locator;
  readonly scheduledOption: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('bulk-send-wizard');
    this.immediateOption = this.dialog.getByTestId('bulk-send-option-immediate');
    this.scheduledOption = this.dialog.getByTestId('bulk-send-option-scheduled');
    this.nextButton = this.dialog.getByTestId('bulk-send-next-button');
    this.backButton = this.dialog.getByTestId('bulk-send-back-button');
    this.submitButton = this.dialog.getByTestId('bulk-send-submit-button');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async selectImmediate() {
    await this.immediateOption.click();
  }

  async selectScheduled() {
    await this.scheduledOption.click();
  }

  async next() {
    await this.nextButton.click();
  }

  async back() {
    await this.backButton.click();
  }

  async send() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.waitForClose();
  }
}
