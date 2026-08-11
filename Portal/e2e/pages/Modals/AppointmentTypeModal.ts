import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods } from '../../utils/const';

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
    this.dialog = page.getByTestId('appointment-type-modal-panel');
    this.nameInput = this.dialog.getByTestId('appointment-type-name-input');
    this.durationInput = this.dialog.getByTestId('appointment-type-duration-input');
    this.descriptionInput = this.dialog.getByTestId('appointment-type-description-input');
    this.priceInput = this.dialog.getByTestId('appointment-type-price-input');
    this.submitButton = this.dialog.getByTestId('appointment-type-submit-button');
    this.cancelButton = this.dialog.getByTestId('appointment-type-cancel-button');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async create(data: { name: string; duration?: string; price?: string }): Promise<string> {
    await this.nameInput.fill(data.name);
    if (data.duration) await this.durationInput.fill(data.duration);
    if (data.price) await this.priceInput.fill(data.price);

    const createTypePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/appointment-types'),
    );

    await this.submitButton.click();

    const response = await createTypePromise;
    expect(response.ok()).toBeTruthy();

    const createdType = await response.json();
    return createdType.data.id;
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }
}
