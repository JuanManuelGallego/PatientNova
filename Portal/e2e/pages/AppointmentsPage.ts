import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { AppointmentModal } from './Modals/AppointmentModal';
import { CancelAppointmentModal } from './Modals/CancelAppointmentModal';
import { AppointmentDrawer } from './Drawers/AppointmentDrawer';

export class AppointmentsPage extends BasePage {
  readonly createButton: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;
  readonly filterAll: Locator;
  readonly filterUpcoming: Locator;
  readonly filterScheduled: Locator;
  readonly filterConfirmed: Locator;
  readonly filterCompleted: Locator;
  readonly filterCancelled: Locator;
  readonly filterNoShow: Locator;
  readonly confirmButton: Locator;
  readonly payButton: Locator;
  readonly deleteRowButton: Locator;
  readonly confirmTestId: string;
  readonly payTestId: string;
  readonly deleteRowTestId: string;

  constructor(page: Page) {
    super(page);
    this.createButton = this.page.getByTestId('appointments-new-button');
    this.table = this.page.getByRole('table');
    this.searchInput = this.page.getByTestId('appointments-search-input');
    this.filterAll = this.page.getByTestId('appointments-filter-all');
    this.filterUpcoming = this.page.getByTestId('appointments-filter-upcoming');
    this.filterScheduled = this.page.getByTestId('appointments-filter-scheduled');
    this.filterConfirmed = this.page.getByTestId('appointments-filter-confirmed');
    this.filterCompleted = this.page.getByTestId('appointments-filter-completed');
    this.filterCancelled = this.page.getByTestId('appointments-filter-cancelled');
    this.filterNoShow = this.page.getByTestId('appointments-filter-no_show');
    this.confirmButton = this.page.getByTestId('appointment-confirm-button');
    this.payButton = this.page.getByTestId('appointment-pay-button');
    this.deleteRowButton = this.page.getByTestId('appointment-row-delete-button');
    this.confirmTestId = 'appointment-confirm-button';
    this.payTestId = 'appointment-pay-button';
    this.deleteRowTestId = 'appointment-row-delete-button';
  }

  async openCreateModal() {
    await this.createButton.click();
    const modal = new AppointmentModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openDrawer(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.click();
    const drawer = new AppointmentDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }

  async confirmAppointment(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator(`[data-testid="${this.confirmTestId}"]`).click();
  }

  async markAsPaid(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator(`[data-testid="${this.payTestId}"]`).click();
  }

  async cancelAppointment(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator(`[data-testid="${this.deleteRowTestId}"]`).click();
    return new CancelAppointmentModal(this.page);
  }

  async searchAppointment(name: string) {
    await this.searchInput.fill(name);
  }

  async expectAppointmentVisible(patientName: string) {
    await expect(this.table.getByRole('row').filter({ hasText: patientName })).toBeVisible();
  }

  async expectAppointmentNotVisible(patientName: string) {
    await expect(this.table.getByRole('row').filter({ hasText: patientName })).not.toBeVisible();
  }

  async filterBy(filterKey: string) {
    await this.page.getByTestId(`appointments-filter-${filterKey}`).click();
  }
}
