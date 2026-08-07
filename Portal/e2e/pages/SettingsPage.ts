import { BasePage } from './BasePage';
import { expect, Page } from '@playwright/test';
import { LocationModal } from './LocationModal';
import { AppointmentTypeModal } from './AppointmentTypeModal';

export class SettingsPage extends BasePage {
  readonly tabProfile = this.page.getByRole('button', { name: 'Perfil' });
  readonly tabSecurity = this.page.getByRole('button', { name: 'Seguridad' });
  readonly tabLocations = this.page.getByRole('button', { name: 'Ubicaciones' });
  readonly tabAppointmentTypes = this.page.getByRole('button', { name: 'Tipos de Cita' });
  readonly tabReminders = this.page.getByRole('button', { name: 'Recordatorios' });
  readonly tabAuditLogs = this.page.getByRole('button', { name: 'Registro de actividad' });

  async goToProfile() { await this.tabProfile.click(); }
  async goToSecurity() { await this.tabSecurity.click(); }
  async goToLocations() { await this.tabLocations.click(); }
  async goToAppointmentTypes() { await this.tabAppointmentTypes.click(); }
  async goToReminders() { await this.tabReminders.click(); }
  async goToAuditLogs() { await this.tabAuditLogs.click(); }

  async openLocationModal() {
    await this.tabLocations.click();
    await this.page.getByRole('button', { name: 'Nueva ubicación' }).click();
    const modal = new LocationModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openAppointmentTypeModal() {
    await this.tabAppointmentTypes.click();
    await this.page.getByRole('button', { name: 'Nuevo tipo' }).click();
    const modal = new AppointmentTypeModal(this.page);
    await modal.waitForOpen();
    return modal;
  }
}
