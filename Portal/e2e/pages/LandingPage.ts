import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { LoginModal } from './LoginModal';

export class LandingPage extends BasePage {
  readonly loginButton: Locator;
  readonly ctaButton: Locator;

  constructor(page: Page) {
    super(page);
    this.loginButton = page.getByTestId('landing-login-button');
    this.ctaButton = page.getByTestId('landing-cta-button');
  }

  async goto() {
    await super.goto('/');
    await this.waitForLoad();
  }

  async openLoginModal() {
    await this.loginButton.click();
    const modal = new LoginModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openLoginModalViaCta() {
    await this.ctaButton.click();
    const modal = new LoginModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async expectVisible() {
    await expect(this.loginButton).toBeVisible();
    await expect(this.ctaButton).toBeVisible();
  }
}
