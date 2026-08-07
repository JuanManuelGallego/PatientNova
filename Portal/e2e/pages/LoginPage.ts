import { BasePage } from './BasePage';
import { expect } from '@playwright/test';

export class LoginPage extends BasePage {
  readonly emailInput = this.page.getByLabel('Correo electrónico');
  readonly passwordInput = this.page.getByLabel('Contraseña');
  readonly submitButton = this.page.getByRole('button', { name: 'Iniciar sesión' });
  readonly errorMessage = this.page.getByRole('alert');

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
