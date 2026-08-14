import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { AppointmentModal } from './Modals/AppointmentModal';
import { CancelAppointmentModal } from './Modals/CancelAppointmentModal';
import { AppointmentDrawer } from './Drawers/AppointmentDrawer';

const PAID_FILTER_LABELS: Record<'true' | 'false' | 'All', string> = {
  true: 'Pagadas',
  false: 'Sin pagar',
  All: 'Todas',
};

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
  readonly paidFilter: Locator;
  readonly dateFilter: Locator;
  readonly dateFilterAcceptButton: Locator;

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
    this.paidFilter = this.page.getByTestId('appointment-paid-filter');
    this.dateFilter = this.page.getByTestId('appointment-date-filter');
    this.dateFilterAcceptButton = this.page.getByRole('button', { name: 'Aceptar' });
  }

  appointmentRow(id: string): Locator {
    return this.page.getByTestId(`appointment-row-${id}`);
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

  async openDrawerById(id: string) {
    await this.appointmentRow(id).click();
    const drawer = new AppointmentDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }

  async confirmAppointment(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator('[data-testid^="appointment-confirm-button-"]').click();
  }

  async confirmAppointmentById(id: string) {
    await this.page.getByTestId(`appointment-confirm-button-${id}`).click();
  }

  async markAsPaid(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator('[data-testid^="appointment-pay-button-"]').click();
  }

  async markAsPaidById(id: string) {
    await this.page.getByTestId(`appointment-pay-button-${id}`).click();
  }

  async cancelAppointment(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator('[data-testid^="appointment-delete-button-"]').click();
    return new CancelAppointmentModal(this.page);
  }

  async cancelAppointmentById(id: string) {
    await this.page.getByTestId(`appointment-delete-button-${id}`).click();
    return new CancelAppointmentModal(this.page);
  }

  async editAppointmentById(id: string) {
    await this.appointmentRow(id).getByTestId(`appointment-edit-button-${id}`).click();
    const modal = new AppointmentModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async setPaidFilter(value: 'true' | 'false' | 'All') {
    await this.paidFilter.click();
    await this.page.getByRole('option', { name: PAID_FILTER_LABELS[value] }).click();
  }

  async setDateFilter(value: string) {
    await this.dateFilter.click();
    await this.page.getByTitle(value).first().click();
    await this.dateFilterAcceptButton.click();
  }

  async goToNextPage() {
    await this.page.getByTestId('appointments-pagination-next').click();
  }

  async goToPreviousPage() {
    await this.page.getByTestId('appointments-pagination-previous').click();
  }

  async goToPage(page: number) {
    await this.page.getByTestId(`appointments-pagination-page-${page}`).click();
  }

  async expectAppointmentRowVisible(id: string) {
    await expect(this.appointmentRow(id)).toBeVisible();
  }

  async expectAppointmentRowHidden(id: string) {
    await expect(this.appointmentRow(id)).not.toBeVisible();
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
