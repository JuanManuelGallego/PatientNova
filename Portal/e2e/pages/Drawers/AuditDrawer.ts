import { expect, Page, Locator } from '@playwright/test';

export class AuditDrawer {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('audit-drawer-panel');
    this.closeButton = page.getByTestId('audit-drawer-close-button');
  }

  async waitForOpen() {
    await expect(this.panel).toBeVisible();
  }

  async close() {
    await this.closeButton.click();
    await expect(this.panel).not.toBeVisible();
  }

  async expectVisible() {
    await expect(this.panel).toBeVisible();
  }

  async expectNotVisible() {
    await expect(this.panel).not.toBeVisible();
  }

  async expectAction(label: string) {
    await expect(this.panel.getByText(label, { exact: true })).toBeVisible();
  }

  async expectEntityType(label: string) {
    await expect(this.panel.getByText(label, { exact: true })).toBeVisible();
  }

  async expectEntityId(id: string) {
    await expect(this.panel.getByText(id)).toBeVisible();
  }

  async expectDescription(text: string) {
    await expect(this.panel.getByText(text)).toBeVisible();
  }

  async expectActor(name: string) {
    await expect(this.panel.getByText(name)).toBeVisible();
  }

  async expectSource(label: string) {
    await expect(this.panel.getByText(label, { exact: true })).toBeVisible();
  }
}
