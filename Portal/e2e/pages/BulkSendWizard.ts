import { expect, Page, Locator } from '@playwright/test';

export class BulkSendWizard {
  readonly page: Page;
  readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /Envío Masivo|Envio Masivo/ });
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async selectImmediate() {
    await this.dialog.getByText('Enviar ahora').first().click();
  }

  async selectScheduled() {
    await this.dialog.getByText('Programar envío').first().click();
  }

  async next() {
    await this.dialog.getByRole('button', { name: /Continuar/ }).click();
  }

  async back() {
    await this.dialog.getByRole('button', { name: /Atrás/ }).click();
  }

  async send() {
    await this.dialog.getByRole('button', { name: /Enviar a \d+ pacientes/ }).click();
  }

  async cancel() {
    await this.dialog.locator('.btn-close').click();
    await this.waitForClose();
  }
}
