import { BasePage } from './BasePage';
import { expect, Page } from '@playwright/test';
import { AppointmentModal } from './AppointmentModal';
import { CancelAppointmentModal } from './CancelAppointmentModal';
import { AppointmentDrawer } from './AppointmentDrawer';

export class AppointmentsPage extends BasePage {
  readonly createButton = this.page.getByRole('button', { name: 'Nueva Cita' });
  readonly table = this.page.getByRole('table');
  readonly searchInput = this.page.getByPlaceholder(/Buscar paciente, tipo, ubicación/);

  readonly filterAll = this.page.getByRole('button', { name: /Todas/ });
  readonly filterUpcoming = this.page.getByRole('button', { name: /Próximas/ });
  readonly filterScheduled = this.page.getByRole('button', { name: /Programadas/ });
  readonly filterConfirmed = this.page.getByRole('button', { name: /Confirmadas/ });
  readonly filterCompleted = this.page.getByRole('button', { name: /Completadas/ });
  readonly filterCancelled = this.page.getByRole('button', { name: /Canceladas/ });
  readonly filterNoShow = this.page.getByRole('button', { name: /No asistió/ });

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
    await row.getByRole('button', { name: /Confirmó/ }).click();
  }

  async markAsPaid(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.getByRole('button', { name: /Pagó/ }).click();
  }

  async cancelAppointment(patientName: string) {
    const row = this.table.getByRole('row').filter({ hasText: patientName });
    await row.locator('.btn-action-delete').click();
    const modal = new CancelAppointmentModal(this.page);
    await expect(modal.dialog).toBeVisible();
    return modal;
  }

  async expectAppointmentVisible(patientName: string) {
    await expect(this.table.getByRole('row').filter({ hasText: patientName })).toBeVisible();
  }
}
