import { HttpMethods, Routes } from '@/e2e/utils/const';
import { Page, Locator, expect } from '@playwright/test';

export class PatientModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly panel: Locator;
  readonly nameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly whatsappInput: Locator;
  readonly smsInput: Locator;
  readonly welcomeCheckbox: Locator;
  readonly welcomeInfoBanner: Locator;
  readonly appointmentTypeSelect: Locator;
  readonly notesInput: Locator;
  readonly statusSelect: Locator;
  readonly error: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('patient-modal-dialog');
    this.panel = this.dialog.getByTestId('patient-modal-panel');
    this.nameInput = this.dialog.getByTestId('patient-name-input');
    this.lastNameInput = this.dialog.getByTestId('patient-lastname-input');
    this.emailInput = this.dialog.getByTestId('patient-email-input');
    this.whatsappInput = this.dialog.getByTestId('patient-whatsapp-input').locator('input.phone-input-number');
    this.smsInput = this.dialog.getByTestId('patient-sms-input').locator('input.phone-input-number');
    this.welcomeCheckbox = this.dialog.getByTestId('patient-welcome-checkbox');
    this.welcomeInfoBanner = this.dialog.getByTestId('patient-welcome-info-banner');
    this.appointmentTypeSelect = this.dialog.getByTestId('patient-appointment-type-select');
    this.notesInput = this.dialog.getByTestId('patient-notes-input');
    this.statusSelect = this.dialog.getByTestId('patient-status-select');
    this.error = this.dialog.getByTestId('patient-modal-error');
    this.submitButton = this.dialog.getByTestId('patient-modal-submit-button');
    this.cancelButton = this.dialog.getByTestId('patient-modal-cancel-button');
    this.closeButton = this.dialog.getByTestId('patient-modal-close-button');
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

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillWhatsappNumber(number: string) {
    await this.whatsappInput.fill(number);
  }

  async fillSmsNumber(number: string) {
    await this.smsInput.fill(number);
  }

  async fillNotes(notes: string) {
    await this.notesInput.fill(notes);
  }

  async checkWelcomeMessage() {
    await this.welcomeCheckbox.check();
  }

  async uncheckWelcomeMessage() {
    await this.welcomeCheckbox.uncheck();
  }

  async selectAppointmentType(type: string) {
    await this.appointmentTypeSelect.getByRole('combobox').click();
    await this.page.getByRole('option', { name: type }).click();
  }

  async selectStatus(status: string) {
    await this.statusSelect.getByRole('combobox').click();
    await this.page.getByRole('option', { name: status }).click();
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }

  async close() {
    await this.closeButton.click();
    await this.waitForClose();
  }

  async expectError(message: string) {
    await expect(this.error).toBeVisible();
    await expect(this.error).toContainText(message);
  }

  async expectNoError() {
    await expect(this.error).not.toBeVisible();
  }

  async expectWelcomeCheckboxVisible() {
    await expect(this.welcomeCheckbox).toBeVisible();
  }

  async expectWelcomeInfoBannerVisible() {
    await expect(this.welcomeInfoBanner).toBeVisible();
  }

  async expectStatusSelectVisible() {
    await expect(this.statusSelect).toBeVisible();
  }

  async expectSubmitDisabled() {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectSubmitEnabled() {
    await expect(this.submitButton).toBeEnabled();
  }

  async createPatient(data: {
    name: string;
    lastName: string;
    email?: string;
    whatsapp?: string;
    sms?: string;
    appointmentType?: string;
    notes?: string;
    sendWelcome?: boolean;
  }): Promise<string> {
    await this.fillRequiredFields(data.name, data.lastName);
    if (data.email) await this.fillEmail(data.email);
    if (data.whatsapp) await this.fillWhatsappNumber(data.whatsapp);
    if (data.sms) await this.fillSmsNumber(data.sms);
    if (data.appointmentType) await this.selectAppointmentType(data.appointmentType);
    if (data.notes) await this.fillNotes(data.notes);
    if (data.sendWelcome) await this.checkWelcomeMessage();

    const createPatientPromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes(Routes.PATIENTS),
    );

    await this.submit();

    const response = await createPatientPromise;
    expect(response.ok()).toBeTruthy();

    const createdPatient = await response.json();
    return createdPatient.data.id;
  }
}
