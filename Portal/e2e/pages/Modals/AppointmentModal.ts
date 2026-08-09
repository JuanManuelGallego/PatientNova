import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods, Routes } from '../../utils/const';

export class AppointmentModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('appointment-modal-dialog');
    this.submitButton = this.dialog.getByTestId('appointment-modal-submit-button');
    this.nextButton = this.dialog.getByTestId('appointment-modal-next-button');
    this.backButton = this.dialog.getByTestId('appointment-modal-back-button');
    this.closeButton = this.dialog.getByTestId('appointment-modal-close-button');
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
    const input = this.dialog.getByRole('combobox');
    await input.click();
    await input.fill(name);
    await this.page.getByRole('option', { name }).click();
  }

  async selectFromDropdown(labelText: string, optionLabel: string) {
    const label = this.dialog.locator('.form-label', { hasText: labelText });
    const trigger = label.getByRole('combobox');
    await trigger.click();
    await this.page.getByRole('option', { name: optionLabel }).click();
  }

  async selectType(name: string) {
    await this.selectFromDropdown('Tipo de cita', name);
  }

  async selectLocation(name: string) {
    await this.selectFromDropdown('Ubicación', name);
  }

  async setPrice(price: number) {
    const input = this.dialog.locator('input[type="number"]');
    await input.fill(String(price));
  }

  async fillNotes(notes: string) {
    const label = this.dialog.locator('.form-label', { hasText: 'Notas' });
    const input = label.locator('input');
    await input.fill(notes);
  }

  async createAppointment(data: {
    patientName: string;
    typeName: string;
    locationName: string;
    price?: number;
    notes?: string;
  }): Promise<string> {
    await this.selectPatient(data.patientName);
    await this.next();

    await this.selectLocation(data.locationName);
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
