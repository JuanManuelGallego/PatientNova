import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { LocationModal } from './Modals/LocationModal';
import { AppointmentTypeModal } from './Modals/AppointmentTypeModal';
import { DeleteLocationModal } from './Modals/DeleteLocationModal';
import { DeleteAppointmentTypeModal } from './Modals/DeleteAppointmentTypeModal';

export class SettingsPage extends BasePage {
  readonly newLocationButton: Locator;
  readonly newTypeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.newLocationButton = this.page.getByTestId('settings-new-location-button');
    this.newTypeButton = this.page.getByTestId('settings-new-type-button');
  }

  private async open(path: string, heading: string) {
    if (!this.page.url().endsWith(path)) await this.page.goto(path);
    await expect(this.page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  }

  async goToProfile() { await this.open('/settings/account', 'Información personal'); }
  async goToSecurity() { await this.open('/settings/account', 'Contraseña'); }
  async goToLocations() { await this.open('/settings/services', 'Ubicaciones de citas'); }
  async goToAppointmentTypes() { await this.open('/settings/services', 'Tipos de cita'); }
  async goToReminders() { await this.open('/settings/notifications', 'Tus avisos'); }

  async openLocationModal() {
    await this.goToLocations();
    await this.newLocationButton.click();
    const modal = new LocationModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openAppointmentTypeModal() {
    await this.goToAppointmentTypes();
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
