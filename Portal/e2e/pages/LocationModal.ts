import { expect, Page, Locator } from '@playwright/test';

export class LocationModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly addressInput: Locator;
  readonly instructionsInput: Locator;
  readonly virtualCheckbox: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('.modal-overlay .modal-panel--sm');
    this.nameInput = this.dialog.getByLabel('Nombre');
    this.addressInput = this.dialog.getByLabel('Dirección');
    this.instructionsInput = this.dialog.getByLabel('Instrucciones para los pacientes');
    this.virtualCheckbox = this.dialog.getByLabel('Es ubicación virtual');
    this.submitButton = this.dialog.getByRole('button', { name: /Crear ubicación|Guardar Cambios/ });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Cancelar' });
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async create(data: { name: string; address?: string; instructions?: string; virtual?: boolean }) {
    await this.nameInput.fill(data.name);
    if (data.virtual) {
      await this.virtualCheckbox.check();
    }
    if (data.address) await this.addressInput.fill(data.address);
    if (data.instructions) await this.instructionsInput.fill(data.instructions);
    await this.submitButton.click();
    await this.waitForClose();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }
}
