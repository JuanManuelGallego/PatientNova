import { expect, Page, Locator } from '@playwright/test';

export class PatientDrawer {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('.drawer-panel');
    this.closeButton = page.locator('.drawer-panel .btn-close--transparent');
    this.editButton = this.panel.getByRole('button', { name: /Editar/ });
    this.deleteButton = this.panel.locator('.btn-drawer-delete');
  }

  async waitForOpen() {
    await expect(this.panel).toBeVisible();
  }

  async waitForClose() {
    await expect(this.panel).not.toBeVisible();
  }

  async close() {
    await this.closeButton.click();
    await this.waitForClose();
  }

  async edit() {
    await this.editButton.click();
  }

  async delete() {
    await this.deleteButton.click();
  }

  async expectSection(title: string) {
    await expect(this.panel.getByText(title)).toBeVisible();
  }
}
