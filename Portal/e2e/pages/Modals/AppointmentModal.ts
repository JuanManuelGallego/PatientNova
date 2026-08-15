import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods, Routes } from '../../utils/const';

export class AppointmentModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly closeButton: Locator;
  readonly patientInput: Locator;
  readonly typeSelect: Locator;
  readonly durationSelect: Locator;
  readonly locationSelect: Locator;
  readonly reminderSelect: Locator;
  readonly priceInput: Locator;
  readonly paidSelect: Locator;
  readonly statusSelect: Locator;
  readonly notesInput: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('appointment-modal-dialog');
    this.submitButton = this.dialog.getByTestId('appointment-modal-submit-button');
    this.nextButton = this.dialog.getByTestId('appointment-modal-next-button');
    this.backButton = this.dialog.getByTestId('appointment-modal-back-button');
    this.closeButton = this.dialog.getByTestId('appointment-modal-close-button');
    this.patientInput = this.dialog.getByTestId('appointment-patient-autocomplete');
    this.typeSelect = this.dialog.getByTestId('appointment-type-select');
    this.durationSelect = this.dialog.getByTestId('appointment-duration-select');
    this.locationSelect = this.dialog.getByTestId('appointment-location-select');
    this.reminderSelect = this.dialog.getByTestId('appointment-reminder-select');
    this.priceInput = this.dialog.getByTestId('appointment-price-input');
    this.paidSelect = this.dialog.getByTestId('appointment-paid-select');
    this.statusSelect = this.dialog.getByTestId('appointment-status-select');
    this.notesInput = this.dialog.getByTestId('appointment-notes-input');
    this.error = this.dialog.locator('.error-inline');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async submit() {
    await this.submitButton.click();
  }

  async next() {
    await this.nextButton.click();
  }

  async back() {
    await this.backButton.click();
  }

  async cancel() {
    await this.closeButton.click();
    await this.waitForClose();
  }

  async selectPatient(name: string) {
    const input = this.patientInput.getByRole('combobox');
    await input.click();
    await input.fill(name);
    await this.page.getByRole('option', { name }).click();
  }

  async selectFromDropdown(trigger: Locator, optionLabel: string) {
    const combobox = trigger.getByRole('combobox');
    await combobox.click();
    await this.page.getByRole('option', { name: optionLabel }).click();
  }

  async selectType(name: string) {
    await this.selectFromDropdown(this.typeSelect, name);
  }

  async selectLocation(name: string) {
    await this.selectFromDropdown(this.locationSelect, name);
  }

  async selectReminderType(label: string) {
    await this.selectFromDropdown(this.reminderSelect, label);
  }

  async setPrice(price: number) {
    await this.priceInput.fill(String(price));
  }

  async setMeetingUrl(url: string) {
    await this.dialog.getByTestId('appointment-meeting-url-input').fill(url);
  }

  async fillNotes(notes: string) {
    await this.notesInput.fill(notes);
  }

  async createAppointment(data: {
    patientName: string;
    typeName: string;
    locationName: string;
    price?: number;
    notes?: string;
    reminderType?: string;
  }): Promise<string> {
    await this.selectPatient(data.patientName);
    await this.selectType(data.typeName)
    await this.next();

    await this.selectLocation(data.locationName);
    if (data.reminderType) await this.selectReminderType(data.reminderType);
    await this.next();

    if (data.price !== undefined) await this.setPrice(data.price);
    if (data.notes) await this.fillNotes(data.notes);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/appointments'),
    );

    await this.submit();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    return created.data.id;
  }
}
