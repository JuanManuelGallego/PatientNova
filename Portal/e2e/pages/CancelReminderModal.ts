import { expect, Page, Locator } from '@playwright/test';

export class CancelReminderModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('alertdialog', { name: /Cancelar Recordatorio/ });
    this.confirmButton = this.dialog.getByRole('button', { name: 'Sí, cancelar' });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Regresar' });
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
