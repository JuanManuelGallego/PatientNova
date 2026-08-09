import { expect, Page, Locator } from '@playwright/test';

export class LoginModal {
  readonly page: Page;
  readonly overlay: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.overlay = page.getByTestId('login-modal-overlay');
    this.emailInput = page.getByTestId('login-modal-email-input');
    this.passwordInput = page.getByTestId('login-modal-password-input');
    this.submitButton = page.getByTestId('login-modal-submit-button');
    this.closeButton = page.getByTestId('login-modal-close-button');
    this.errorMessage = page.getByTestId('login-modal-error-alert');
  }

  async waitForOpen() {
    await expect(this.overlay).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL(/\/dashboard/);
  }

  async close() {
    await this.closeButton.click();
    await expect(this.overlay).not.toBeVisible();
  }

  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }
}
