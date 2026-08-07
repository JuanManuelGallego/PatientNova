import { expect, Page, Locator } from '@playwright/test';

export class ReminderModal {
  readonly page: Page;
  readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /Recordatorio/ });
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async next() {
    await this.dialog.getByRole('button', { name: /Continuar/ }).click();
  }

  async back() {
    await this.dialog.getByRole('button', { name: /Atrás/ }).click();
  }

  async submit() {
    await this.dialog.getByRole('button', { name: /Enviar ahora|Programar/ }).click();
  }

  async cancel() {
    await this.dialog.locator('.btn-close').click();
    await this.waitForClose();
  }
}
