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
    this.dialog = page.getByTestId('location-modal-panel');
    this.nameInput = this.dialog.getByTestId('location-name-input');
    this.addressInput = this.dialog.getByTestId('location-address-input');
    this.instructionsInput = this.dialog.getByTestId('location-instructions-input');
    this.virtualCheckbox = this.dialog.getByTestId('location-virtual-checkbox');
    this.submitButton = this.dialog.getByTestId('location-modal-submit-button');
    this.cancelButton = this.dialog.getByTestId('location-modal-cancel-button');
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
