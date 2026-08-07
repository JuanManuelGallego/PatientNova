import { expect, Page, Locator } from '@playwright/test';

export class BlockedTimeModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /Bloquear horario|Editar horario bloqueado/ });
    this.submitButton = this.dialog.getByRole('button', { name: /Bloquear|Guardar Cambios/ });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Cancelar' });
    this.deleteButton = this.dialog.locator('.btn-action-delete');
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
