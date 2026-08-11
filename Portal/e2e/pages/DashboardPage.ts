import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';

export class DashboardPage extends BasePage {
  readonly statCitasHoy: Locator;
  readonly statPacientes: Locator;
  readonly statRecordatorios: Locator;
  readonly statSinPagar: Locator;
  readonly statIngresos: Locator;
  readonly newAppointmentButton: Locator;
  readonly newPatientButton: Locator;

  constructor(page: Page) {
    super(page);
    this.statCitasHoy = this.page.getByTestId('stat-card-citas-hoy');
    this.statPacientes = this.page.getByTestId('stat-card-pacientes');
    this.statRecordatorios = this.page.getByTestId('stat-card-recordatorios');
    this.statSinPagar = this.page.getByTestId('stat-card-sin-pagar');
    this.statIngresos = this.page.getByTestId('stat-card-ingresos');
    this.newAppointmentButton = this.page.getByTestId('dashboard-new-appointment-button');
    this.newPatientButton = this.page.getByTestId('dashboard-new-patient-button');
  }

  async expectLoaded() {
    await expect(this.page.getByText(/Buenos días|Buenas tardes|Buenas noches/)).toBeVisible();
  }
}
