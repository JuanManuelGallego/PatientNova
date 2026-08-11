import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { PatientModal } from './Modals/PatientModal';
import { DeletePatientModal } from './Modals/DeletePatientModal';
import { PatientDrawer } from './Drawers/PatientDrawer';

export class PatientsPage extends BasePage {
  readonly createButton: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;
  readonly statTotal: Locator;
  readonly statActive: Locator;
  readonly statInactive: Locator;
  readonly deleteRowButton: Locator;
  readonly deleteRowTestId: string;

  constructor(page: Page) {
    super(page);
    this.createButton = this.page.getByTestId('patients-new-button');
    this.table = this.page.getByRole('table');
    this.searchInput = this.page.getByRole('textbox', { name: 'Buscar por nombre, apellido o' })
    this.statTotal = this.page.getByTestId('stat-card-total-pacientes');
    this.statActive = this.page.getByTestId('stat-card-activos');
    this.statInactive = this.page.getByTestId('stat-card-inactivos');
    this.deleteRowButton = this.page.getByTestId('patient-row-delete-button');
    this.deleteRowTestId = 'patient-row-delete-button';
  }

  async openCreateModal() {
    await this.createButton.click();
    const modal = new PatientModal(this.page)
    await modal.waitForOpen()
    return modal
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
    const modal = new PatientModal(this.page)
    await modal.waitForOpen()
    return modal
  }

  async openDeleteModal(name: string) {
    const row = this.table.getByRole('row').filter({ hasText: name });
    await row.locator(`[data-testid="${this.deleteRowTestId}"]`).click();
    const modal = new DeletePatientModal(this.page)
    await modal.waitForOpen()
    return modal

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

  async searchPatient(name: string) {
    await this.searchInput.fill(name);
  }

  async clearSearch() {
    await this.searchInput.fill('');
  }
}
