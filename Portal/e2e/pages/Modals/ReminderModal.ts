import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods } from '../../utils/const';
import { randomString } from '../../utils/test-data';
import { ReminderMode } from '@/src/types/Reminder';

export class ReminderModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;
  readonly sendAtPicker: Locator;
  readonly datePickerAccept: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('reminder-modal-dialog');
    this.nextButton = this.page.getByTestId('reminder-modal-next-button');
    this.backButton = this.page.getByTestId('reminder-modal-back-button');
    this.submitButton = this.page.getByTestId('reminder-modal-submit-button');
    this.closeButton = this.page.getByTestId('reminder-modal-close-button');
    this.sendAtPicker = this.page.getByTestId('reminder-send-at-picker');
    this.datePickerAccept = this.page.getByRole('button', { name: 'Aceptar' });
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
    await this.sendAtPicker.click();
    await this.page.getByText('30').nth(1).click()
    await this.datePickerAccept.click();
  }

  async fillAllVariablesWithRandomString() {
    //const variables = this.dialog.locator('.form-label:has(.form-input) .form-input');
    // const variables = this.page.locator('textbox');
    // const count = await variables.count();
    // for (let i = 1; i < count; i++) {
    //   await variables.nth(i).fill(randomString(10));
    // }

    const textboxes = await this.page.getByRole('textbox').all();

    for (let i = 2; i < textboxes.length; i++) {
      await textboxes[ i ].fill(randomString());
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
    sendMode: ReminderMode
    appointmentDateLabel?: string;
  }): Promise<string> {
    await this.selectSendMode(data.sendMode);
    if (data.sendMode === ReminderMode.SCHEDULED) {
      await this.selectSendAt(' tomorrow at 10:00');
    }

    await this.selectPatient(data.patientName);
    if (data.appointmentDateLabel) await this.selectAppointment(data.appointmentDateLabel);


    await this.next();
    await this.next();

    await this.fillAllVariablesWithRandomString()

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
