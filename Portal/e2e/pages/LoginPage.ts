import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = this.page.getByTestId('login-email-input');
    this.passwordInput = this.page.getByTestId('login-password-input');
    this.submitButton = this.page.getByTestId('login-submit-button');
    this.errorMessage = this.page.getByTestId('login-error-alert');
  }

  async login(email: string, password: string) {
    await this.goto('/login');
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL(/\/dashboard/);
  }

  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }
}
