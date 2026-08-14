import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods } from '../../utils/const';

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

  async create(data: { name: string; address?: string; instructions?: string; virtual?: boolean }): Promise<string> {
    await this.nameInput.fill(data.name);
    if (data.virtual) {
      await this.virtualCheckbox.check();
    }
    if (data.address) await this.addressInput.fill(data.address);
    if (data.instructions) await this.instructionsInput.fill(data.instructions);

    const createLocationPromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/locations'),
    );

    await this.submitButton.click();

    const response = await createLocationPromise;
    expect(response.ok()).toBeTruthy();

    const createdLocation = await response.json();
    return createdLocation.data.id;
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }

  async edit(data: {
    name?: string;
    address?: string;
    instructions?: string;
  }): Promise<{ id: string; name: string; address: string; instructions: string }> {
    if (data.name) await this.nameInput.fill(data.name);
    if (data.address !== undefined) await this.addressInput.fill(data.address);
    if (data.instructions !== undefined) await this.instructionsInput.fill(data.instructions);

    const updatePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.PATCH &&
        response.url().includes('/locations/'),
    );

    await this.submitButton.click();

    const response = await updatePromise;
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const json = await response.json();
    return json.data;
  }
}
