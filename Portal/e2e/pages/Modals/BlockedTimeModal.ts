import { expect, Page, Locator } from '@playwright/test';
import { HttpMethods } from '../../utils/const';

export class BlockedTimeModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly descriptionInput: Locator;
  readonly startTimeInput: Locator;
  readonly endTimeInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId('blocked-time-modal-dialog');
    this.submitButton = this.dialog.getByTestId('blocked-time-modal-submit-button');
    this.cancelButton = this.dialog.getByTestId('blocked-time-modal-cancel-button');
    this.deleteButton = this.dialog.getByTestId('blocked-time-modal-delete-button');
    this.descriptionInput = this.dialog.getByTestId('blocked-time-description-input');
    this.startTimeInput = this.dialog.getByTestId('blocked-time-start-input');
    this.endTimeInput = this.dialog.getByTestId('blocked-time-end-input');
  }

  async waitForOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async waitForClose() {
    await expect(this.dialog).not.toBeVisible();
  }

  async submit() {
    await this.submitButton.click();
    await this.waitForClose();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClose();
  }

  async delete() {
    await this.deleteButton.click();
  }

  async createBlockedTime(data: {
    description: string;
    startTimeUtc?: string;
    endTimeUtc?: string;
  }): Promise<string> {
    await this.descriptionInput.fill(data.description);
    if (data.startTimeUtc) {
      await this.startTimeInput.fill(data.startTimeUtc);
    }
    if (data.endTimeUtc) {
      await this.endTimeInput.fill(data.endTimeUtc);
    }

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/blocked-time'),
    );

    await this.submit();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    return created.data.id;
  }

  async editBlockedTime(data: { description: string }): Promise<{ id: string; description: string; isDeleted?: boolean; deletedAt?: string | null }> {
    await this.descriptionInput.fill(data.description);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.PATCH &&
        response.url().includes('/blocked-time/'),
    );

    await this.submit();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const json = await response.json();
    return json.data;
  }

  async deleteBlockedTime(): Promise<void> {
    await this.deleteButton.click();
  }
}
