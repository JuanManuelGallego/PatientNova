import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods } from '../../utils/const';
import { randomString } from '../../utils/test-data';

export class ReminderModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;
  readonly sendAtPicker: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('reminder-modal-dialog');
    this.nextButton = this.dialog.getByTestId('reminder-modal-next-button');
    this.backButton = this.dialog.getByTestId('reminder-modal-back-button');
    this.submitButton = this.dialog.getByTestId('reminder-modal-submit-button');
    this.closeButton = this.dialog.getByTestId('reminder-modal-close-button');
    this.sendAtPicker = this.dialog.getByTestId('reminder-send-at-picker');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async next() {
    await this.nextButton.click();
  }

  async back() {
    await this.backButton.click();
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.closeButton.click();
    await this.waitForClose();
  }

  async selectSendMode(mode: 'IMMEDIATE' | 'SCHEDULED') {
    const label = mode === 'IMMEDIATE' ? 'Enviar ahora' : 'Programar envío';
    await this.dialog.getByText(label).click();
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

  async selectAppointment(dateLabel: string) {
    await this.selectFromDropdown('Asociar a cita', dateLabel);
  }

  async selectTemplate(label: string) {
    await this.selectFromDropdown('Plantilla', label);
  }

  async selectSendAt(dateString: string) {
    const input = this.sendAtPicker.getByRole('textbox');
    await input.click();
    //await input.fill(dateString);
    await input.press('Enter');
  }

  async fillAllVariablesWithRandomString() {
    const variables = this.dialog.locator('.form-label:has(.form-input) .form-input');
    const count = await variables.count();
    for (let i = 0; i < count; i++) {
      await variables.nth(i).fill(randomString(10));
    }
  }

  async fillVariable(label: string, value: string) {
    const field = this.dialog.locator('.form-label', { hasText: label });
    const input = field.locator('input');
    await input.fill(value);
  }

  async fillMessage(msg: string) {
    const label = this.dialog.locator('.form-label', { hasText: 'Mensaje personalizado' });
    const textarea = label.locator('textarea');
    await textarea.fill(msg);
  }

  async createReminder(data: {
    patientName: string;
    appointmentDateLabel?: string;
    sendMode?: 'IMMEDIATE' | 'SCHEDULED';
  }): Promise<string> {
    const mode = data.sendMode ?? 'SCHEDULED';
    await this.selectSendMode(mode);
    await this.selectPatient(data.patientName);

    if (data.appointmentDateLabel) await this.selectAppointment(data.appointmentDateLabel);

    if (mode === 'SCHEDULED') {
      await this.selectSendAt(' tomorrow at 10:00');
    }

    await this.next();

    await this.next();

    await this.next();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/reminders'),
    );

    await this.submit();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    return created.data.id;
  }
}
