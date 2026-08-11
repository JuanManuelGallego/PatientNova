import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { LocationModal } from './Modals/LocationModal';
import { AppointmentTypeModal } from './Modals/AppointmentTypeModal';

export class SettingsPage extends BasePage {
  readonly tabProfile: Locator;
  readonly tabSecurity: Locator;
  readonly tabLocations: Locator;
  readonly tabAppointmentTypes: Locator;
  readonly tabReminders: Locator;
  readonly tabAuditLogs: Locator;
  readonly newLocationButton: Locator;
  readonly newTypeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.tabProfile = this.page.getByTestId('settings-tab-perfil');
    this.tabSecurity = this.page.getByTestId('settings-tab-seguridad');
    this.tabLocations = this.page.getByTestId('settings-tab-ubicaciones');
    this.tabAppointmentTypes = this.page.getByTestId('settings-tab-tipos-de-cita');
    this.tabReminders = this.page.getByTestId('settings-tab-recordatorios');
    this.tabAuditLogs = this.page.getByTestId('settings-tab-registro-de-actividad');
    this.newLocationButton = this.page.getByTestId('settings-new-location-button');
    this.newTypeButton = this.page.getByTestId('settings-new-type-button');
  }

  async goToProfile() { await this.tabProfile.click(); }
  async goToSecurity() { await this.tabSecurity.click(); }
  async goToLocations() { await this.tabLocations.click(); }
  async goToAppointmentTypes() { await this.tabAppointmentTypes.click(); }
  async goToReminders() { await this.tabReminders.click(); }
  async goToAuditLogs() { await this.tabAuditLogs.click(); }

  async openLocationModal() {
    await this.tabLocations.click();
    await this.newLocationButton.click();
    const modal = new LocationModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openAppointmentTypeModal() {
    await this.tabAppointmentTypes.click();
    await this.newTypeButton.click();
    const modal = new AppointmentTypeModal(this.page);
    await modal.waitForOpen();
    return modal;
  }
}
