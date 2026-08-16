import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods } from '../../utils/const';
import { randomString, futureDateTime } from '../../utils/test-data';
import { ReminderMode } from '@/src/types/Reminder';

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
    this.nextButton = this.page.getByTestId('reminder-modal-next-button');
    this.backButton = this.page.getByTestId('reminder-modal-back-button');
    this.submitButton = this.page.getByTestId('reminder-modal-submit-button');
    this.closeButton = this.page.getByTestId('reminder-modal-close-button');
    this.sendAtPicker = this.page.getByTestId('reminder-send-at-picker');
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
    const input = this.dialog.locator('input.patient-autocomplete__input');
    await input.click();
    await input.fill(name);
    const option = this.page.getByRole('option', { name }).first();
    await option.waitFor();
    await input.press('Enter');
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
    await ReminderModal.pickDateTime(this.page, this.sendAtPicker, dateString);
  }

  static async pickDateTime(page: Page, picker: Locator, dateString: string) {
    const iso = new Date(dateString);
    const dayNumber = String(iso.getDate());
    const hourRaw = iso.getHours();
    const minuteRaw = iso.getMinutes();
    const hourRe = new RegExp(`^0?${hourRaw}$`);
    const minuteRe = new RegExp(`^0?${minuteRaw}$`);

    await picker.click();

    const now = new Date();
    const monthDiff =
      (iso.getFullYear() - now.getFullYear()) * 12 + (iso.getMonth() - now.getMonth());
    if (monthDiff !== 0) {
      const nextBtn = page.locator('.ant-picker-header-next-btn');
      const prevBtn = page.locator('.ant-picker-header-prev-btn');
      const btn = monthDiff > 0 ? nextBtn : prevBtn;
      for (let i = 0; i < Math.abs(monthDiff); i++) {
        await btn.click();
      }
    }

    const dayCell = page
      .locator('.ant-picker-cell-in-view')
      .filter({ hasText: new RegExp(`^${dayNumber}$`) })
      .first();
    await dayCell.click();

    await page.locator('.ant-picker-time-panel-column').first()
      .getByText(hourRe).first().click();
    await page.locator('.ant-picker-time-panel-column').nth(1)
      .getByText(minuteRe).first().click();

    await page.getByRole('button', { name: 'Aceptar' }).click();
  }

  async fillAllVariablesWithRandomString() {
    const inputs = this.dialog.locator('input.form-input');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).fill(randomString());
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
      await this.selectSendAt(futureDateTime(48));
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
