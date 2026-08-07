import { expect, Page, Locator } from '@playwright/test';

export class EditReminderModal {
  readonly page: Page;
  readonly panel: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('.modal-panel--sm');
    this.saveButton = this.panel.getByRole('button', { name: 'Reprogramar' });
    this.cancelButton = this.panel.getByRole('button', { name: 'Cancelar' });
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
