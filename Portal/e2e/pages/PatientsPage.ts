import { BasePage } from './BasePage';
import { expect, Page } from '@playwright/test';
import { PatientModal } from './PatientModal';
import { DeletePatientModal } from './DeletePatientModal';
import { PatientDrawer } from './PatientDrawer';

export class PatientsPage extends BasePage {
  readonly createButton = this.page.getByRole('button', { name: 'Nuevo Paciente' });
  readonly table = this.page.getByRole('table');
  readonly searchInput = this.page.getByPlaceholder(/Buscar/);
  readonly statTotal = this.page.locator('.stat-card').filter({ hasText: 'Total Pacientes' });
  readonly statActive = this.page.locator('.stat-card').filter({ hasText: 'Activos' });
  readonly statInactive = this.page.locator('.stat-card').filter({ hasText: 'Inactivos' });

  async openCreateModal() {
    await this.createButton.click();
    const modal = new PatientModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openRowActions(name: string) {
    const row = this.table.getByRole('row').filter({ hasText: name });
    await row.hover();
    return row;
  }

  async openDrawer(name: string) {
    const row = this.table.getByRole('row').filter({ hasText: name });
    await row.click();
    const drawer = new PatientDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }

  async openEditModal(name: string) {
    const row = this.table.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: /Editar/ }).click();
    const modal = new PatientModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openDeleteModal(name: string) {
    const row = this.table.getByRole('row').filter({ hasText: name });
    await row.locator('.btn-action-delete').click();
    const modal = new DeletePatientModal(this.page);
    await expect(modal.dialog).toBeVisible();
    return modal;
  }

  async expectPatientVisible(name: string) {
    await expect(this.table.getByRole('row').filter({ hasText: name })).toBeVisible();
  }

  async expectPatientNotVisible(name: string) {
    await expect(this.table.getByRole('row').filter({ hasText: name })).not.toBeVisible();
  }

  async getRowCount() {
    return this.table.getByRole('row').count();
  }
}
