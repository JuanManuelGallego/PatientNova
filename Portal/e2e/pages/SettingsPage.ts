import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { LocationModal } from './Modals/LocationModal';
import { AppointmentTypeModal } from './Modals/AppointmentTypeModal';
import { DeleteLocationModal } from './Modals/DeleteLocationModal';
import { DeleteAppointmentTypeModal } from './Modals/DeleteAppointmentTypeModal';

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

  locationCard(id: string): Locator {
    return this.page.getByTestId(`location-card-${id}`);
  }

  appointmentTypeCard(id: string): Locator {
    return this.page.getByTestId(`appointment-type-card-${id}`);
  }

  async editLocation(id: string): Promise<LocationModal> {
    await this.goToLocations();
    await this.locationCard(id).getByTestId(`location-edit-button-${id}`).click();
    const modal = new LocationModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async editAppointmentType(id: string): Promise<AppointmentTypeModal> {
    await this.goToAppointmentTypes();
    await this.appointmentTypeCard(id).getByTestId(`appointment-type-edit-button-${id}`).click();
    const modal = new AppointmentTypeModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async deleteLocation(id: string): Promise<DeleteLocationModal> {
    await this.goToLocations();
    await this.locationCard(id).getByTestId(`location-delete-button-${id}`).click();
    const modal = new DeleteLocationModal(this.page);
    await expect(modal.dialog).toBeVisible();
    return modal;
  }

  async deleteAppointmentType(id: string): Promise<DeleteAppointmentTypeModal> {
    await this.goToAppointmentTypes();
    await this.appointmentTypeCard(id).getByTestId(`appointment-type-delete-button-${id}`).click();
    const modal = new DeleteAppointmentTypeModal(this.page);
    await expect(modal.dialog).toBeVisible();
    return modal;
  }
}
