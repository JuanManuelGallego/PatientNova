import { expect, Page, Locator } from '@playwright/test';
import { ReminderModal } from './ReminderModal';

export class EditReminderModal {
  readonly page: Page;
  readonly panel: Locator;
  readonly sendAtPicker: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('edit-reminder-modal-panel');
    this.sendAtPicker = page.getByTestId('edit-reminder-send-at-picker');
    this.saveButton = this.panel.getByTestId('edit-reminder-save-button');
    this.cancelButton = this.panel.getByTestId('edit-reminder-cancel-button');
  }

  async waitForOpen() {
    await expect(this.panel).toBeVisible();
  }

  async selectSendAt(dateString: string) {
    await ReminderModal.pickDateTime(this.page, this.sendAtPicker, dateString);
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
