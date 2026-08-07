import { BasePage } from './BasePage';
import { expect } from '@playwright/test';

export class DashboardPage extends BasePage {
  readonly statCitasHoy = this.page.locator('.stat-card').filter({ hasText: 'Citas Hoy' });
  readonly statPacientes = this.page.locator('.stat-card').filter({ hasText: 'Pacientes' });
  readonly statRecordatorios = this.page.locator('.stat-card').filter({ hasText: 'Recordatorios' });
  readonly statSinPagar = this.page.locator('.stat-card').filter({ hasText: 'Sin Pagar' });
  readonly statIngresos = this.page.locator('.stat-card').filter({ hasText: 'Ingresos' });

  readonly newAppointmentButton = this.page.getByRole('link', { name: 'Nueva Cita' });
  readonly newPatientButton = this.page.getByRole('link', { name: 'Nuevo Paciente' });

  async expectLoaded() {
    await expect(this.page.getByText(/Buenos días|Buenas tardes|Buenas noches/)).toBeVisible();
  }
}
