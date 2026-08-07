import { expect, Page, Locator } from '@playwright/test';

export class AppointmentTypeModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly durationInput: Locator;
  readonly descriptionInput: Locator;
  readonly priceInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('.modal-overlay .modal-panel--sm');
    this.nameInput = this.dialog.getByLabel('Nombre');
    this.durationInput = this.dialog.getByLabel('Duración por defecto (min)');
    this.descriptionInput = this.dialog.getByLabel('Descripción');
    this.priceInput = this.dialog.getByLabel('Precio por defecto');
    this.submitButton = this.dialog.getByRole('button', { name: /Crear tipo|Guardar Cambios/ });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Cancelar' });
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async create(data: { name: string; duration?: string; price?: string }) {
    await this.nameInput.fill(data.name);
    if (data.duration) await this.durationInput.fill(data.duration);
    if (data.price) await this.priceInput.fill(data.price);
    await this.submitButton.click();
    await this.waitForClose();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }
}
