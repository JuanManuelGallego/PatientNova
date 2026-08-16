import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { AppointmentModal } from './Modals/AppointmentModal';
import { CancelAppointmentModal } from './Modals/CancelAppointmentModal';
import { AppointmentDrawer } from './Drawers/AppointmentDrawer';

const PAID_FILTER_LABELS: Record<'true' | 'false' | 'All', string> = {
  true: 'Pagadas',
  false: 'Sin pagar',
  All: 'Todos',
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: 'Todos',
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export class AppointmentsPage extends BasePage {
  readonly createButton: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;
  readonly statusFilterTrigger: Locator;
  readonly statusFilterPopover: Locator;
  readonly paidFilterTrigger: Locator;
  readonly paidFilterPopover: Locator;
  readonly dateFilterTrigger: Locator;
  readonly dateFilterAcceptButton: Locator;

  constructor(page: Page) {
    super(page);
    this.createButton = this.page.getByTestId('appointments-new-button');
    this.table = this.page.getByRole('table');
    this.searchInput = this.page.getByTestId('appointments-search-input');
    this.statusFilterTrigger = this.page.getByTestId('appointment-status-filter-trigger');
    this.statusFilterPopover = this.page.getByTestId('appointment-status-filter');
    this.paidFilterTrigger = this.page.getByTestId('appointment-paid-filter-trigger');
    this.paidFilterPopover = this.page.getByTestId('appointment-paid-filter');
    this.dateFilterTrigger = this.page.getByTestId('appointment-date-range-filter-trigger');
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
    // Click the patient cell, not the whole row — the location cell may
    // contain a virtual-meeting link that would navigate away.
    await this.appointmentRow(id).locator('td').first().click();
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
    await this.paidFilterTrigger.click();
    // Enum popovers stay open after selection, so clear first (the "Todos"
    // choice is an `option`, not a button) then pick the target.
    await this.paidFilterPopover.getByRole('option', { name: 'Todos' }).click();
    if (value !== 'All') {
      await this.paidFilterPopover.getByRole('option', { name: PAID_FILTER_LABELS[value] }).click();
    }
    await this.paidFilterTrigger.click();
  }

  async setDateRange(from: string, to: string) {
    await this.dateFilterTrigger.click();
    await this.page.getByPlaceholder('Desde').click();
    const clickDay = async (value: string) => {
      const d = value.split('T')[0].split('-')[2];
      await this.page
        .locator('.ant-picker-cell-in-view')
        .filter({ hasText: d })
        .first()
        .click();
    };
    await clickDay(from);
    await clickDay(to);
  }

  async goToNextPage() {
    await this.page.getByTestId('appointments-pagination-next').click();
  }

  async switchToTab(tab: 'upcoming' | 'history') {
    const label = tab === 'upcoming' ? 'Próximas' : 'Historial';
    await this.page.getByRole('button', { name: label, exact: true }).click();
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
    const label = STATUS_FILTER_LABELS[filterKey];
    await this.statusFilterTrigger.click();
    // Enum popovers stay open after selection and accumulate; clear first
    // (the "Todos" choice is an `option`, not a button) then pick the target.
    await this.statusFilterPopover.getByRole('option', { name: 'Todos' }).click();
    if (filterKey !== 'all') {
      await this.statusFilterPopover.getByRole('option', { name: label }).click();
    }
    await this.statusFilterTrigger.click();
  }
}
