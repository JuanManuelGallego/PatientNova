import { expect, Page, Locator } from '@playwright/test';

export class AppointmentDrawer {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly editButton: Locator;
  readonly payButton: Locator;
  readonly deleteButton: Locator;
  readonly typeName: Locator;
  readonly patientName: Locator;
  readonly patientEmail: Locator;
  readonly date: Locator;
  readonly time: Locator;
  readonly duration: Locator;
  readonly location: Locator;
  readonly price: Locator;
  readonly paidStatus: Locator;
  readonly notes: Locator;
  readonly auditLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('appointment-drawer-panel');
    this.closeButton = page.getByTestId('appointment-drawer-close-button');
    this.editButton = this.panel.getByTestId('appointment-drawer-edit-button');
    this.payButton = this.panel.getByTestId('appointment-drawer-pay-button');
    this.deleteButton = this.panel.getByTestId('appointment-drawer-delete-button');
    this.typeName = this.panel.getByTestId('appointment-drawer-type-name');
    this.patientName = this.panel.getByTestId('appointment-drawer-patient-name');
    this.patientEmail = this.panel.getByTestId('appointment-drawer-patient-email');
    this.date = this.panel.getByTestId('appointment-drawer-date');
    this.time = this.panel.getByTestId('appointment-drawer-time');
    this.duration = this.panel.getByTestId('appointment-drawer-duration');
    this.location = this.panel.getByTestId('appointment-drawer-location');
    this.price = this.panel.getByTestId('appointment-drawer-price');
    this.paidStatus = this.panel.getByTestId('appointment-drawer-paid-status');
    this.notes = this.panel.getByTestId('appointment-drawer-notes');
    this.auditLink = this.panel.getByTestId('appointment-drawer-audit-link');
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

  async markAsPaid() {
    await this.payButton.click();
  }

  async delete() {
    await this.deleteButton.click();
  }

  async expectSection(title: string) {
    await expect(this.panel.getByText(title)).toBeVisible();
  }

  async expectContent(opts: {
    patientName?: string;
    typeName?: string;
    location?: string;
  }) {
    await expect(this.panel.getByTestId('appointment-drawer-section-paciente')).toBeVisible();
    await expect(this.panel.getByTestId('appointment-drawer-section-fecha-hora')).toBeVisible();
    await expect(this.panel.getByTestId('appointment-drawer-section-lugar')).toBeVisible();
    await expect(this.panel.getByTestId('appointment-drawer-section-pago')).toBeVisible();
    if (opts.patientName) await expect(this.patientName).toContainText(opts.patientName);
    if (opts.typeName) await expect(this.typeName).toContainText(opts.typeName);
    if (opts.location) await expect(this.location).toContainText(opts.location);
  }
}
