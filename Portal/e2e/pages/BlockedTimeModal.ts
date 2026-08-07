import { expect, Page, Locator } from '@playwright/test';

export class BlockedTimeModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('blocked-time-modal-dialog');
    this.submitButton = this.dialog.getByTestId('blocked-time-modal-submit-button');
    this.cancelButton = this.dialog.getByTestId('blocked-time-modal-cancel-button');
    this.deleteButton = this.dialog.getByTestId('blocked-time-modal-delete-button');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async submit() {
    await this.submitButton.click();
    await this.waitForClose();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }

  async delete() {
    await this.deleteButton.click();
  }
}
