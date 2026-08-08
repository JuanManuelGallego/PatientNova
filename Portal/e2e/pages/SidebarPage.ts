import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';

export class SidebarPage extends BasePage {
  readonly sidebar: Locator;
  readonly nav: Locator;
  readonly hamburger: Locator;
  readonly backdrop: Locator;
  readonly userSection: Locator;
  readonly themeToggle: Locator;
  readonly logoutButton: Locator;
  readonly brandName: Locator;

  readonly links: Record<string, Locator>;

  constructor(page: Page) {
    super(page);
    this.sidebar = page.getByTestId('sidebar');
    this.nav = page.getByTestId('sidebar-nav');
    this.hamburger = page.getByTestId('hamburger-button');
    this.backdrop = page.getByTestId('sidebar-backdrop');
    this.userSection = page.getByTestId('sidebar-user');
    this.themeToggle = page.getByTestId('sidebar-theme-toggle');
    this.logoutButton = page.getByTestId('sidebar-logout');
    this.brandName = page.locator('.sidebar-brand__name');

    this.links = {
      dashboard: page.getByTestId('sidebar-link-dashboard'),
      patients: page.getByTestId('sidebar-link-patients'),
      'medical-records': page.getByTestId('sidebar-link-medical-records'),
      appointments: page.getByTestId('sidebar-link-appointments'),
      calendar: page.getByTestId('sidebar-link-calendar'),
      reminders: page.getByTestId('sidebar-link-reminders'),
      settings: page.getByTestId('sidebar-link-settings'),
    };
  }

  async expectVisible() {
    await expect(this.sidebar).toBeVisible();
  }

  async expectHidden() {
    await expect(this.sidebar).toBeHidden();
  }

  async expectNavVisible() {
    await expect(this.nav).toBeVisible();
  }

  async expectBrandVisible() {
    await expect(this.brandName).toBeVisible();
    await expect(this.brandName).toHaveText('Patient Nova');
  }

  async expectUserSectionVisible() {
    await expect(this.userSection).toBeVisible();
  }

  async expectAllNavLinksVisible() {
    for (const link of Object.values(this.links)) {
      await expect(link).toBeVisible();
    }
  }

  async expectActiveLink(id: string) {
    const link = this.links[id];
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(link.locator('.nav-item')).toHaveClass(/active/);
  }

  async expectNoActiveLink() {
    for (const link of Object.values(this.links)) {
      await expect(link).not.toHaveAttribute('aria-current', 'page');
    }
  }

  async clickLink(id: string) {
    await this.links[id].click();
  }

  async openOnMobile() {
    await this.hamburger.click();
    await expect(this.sidebar).toHaveClass(/sidebar--open/);
    await expect(this.backdrop).toBeVisible();
  }

  async closeOnMobile() {
    await this.backdrop.click();
    await expect(this.sidebar).not.toHaveClass(/sidebar--open/);
    await expect(this.backdrop).toBeHidden();
  }

  async closeOnMobileViaEscape() {
    await this.page.keyboard.press('Escape');
    await expect(this.sidebar).not.toHaveClass(/sidebar--open/);
  }

  async expectLogoutButtonVisible() {
    await expect(this.logoutButton).toBeVisible();
  }
}
