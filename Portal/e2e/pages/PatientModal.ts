import { Page, Locator, expect } from '@playwright/test';

export class PatientModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('patient-modal-dialog');
    this.nameInput = this.dialog.getByTestId('patient-name-input');
    this.lastNameInput = this.dialog.getByTestId('patient-lastname-input');
    this.emailInput = this.dialog.getByTestId('patient-email-input');
    this.submitButton = this.dialog.getByTestId('patient-modal-submit-button');
    this.cancelButton = this.dialog.getByTestId('patient-modal-cancel-button');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async fillRequiredFields(name: string, lastName: string) {
    await this.nameInput.fill(name);
    await this.lastNameInput.fill(lastName);
  }

  async fillOptionalEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async createPatient(data: { name: string; lastName: string; email?: string }) {
    await this.fillRequiredFields(data.name, data.lastName);
    if (data.email) await this.fillOptionalEmail(data.email);
    await this.submit();
    await this.waitForClose();
  }
}
