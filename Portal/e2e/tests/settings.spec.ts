import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages/SettingsPage';
import { uniqueName } from '../utils/test-data';
import { Routes } from '../utils/const';

test.describe('Settings', () => {
  test.describe('Profile Tab', () => {
    test('Display profile form fields', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const firstNameInput = page.getByTestId('profile-first-name-input');
      const lastNameInput = page.getByTestId('profile-last-name-input');
      await expect(firstNameInput).toBeVisible();
      await expect(lastNameInput).toBeVisible();
    });

    test('Update profile fields with auto-save', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const firstNameInput = page.getByTestId('profile-first-name-input');
      await expect(firstNameInput).toBeVisible();

      const originalValue = await firstNameInput.inputValue();
      const testValue = originalValue === 'Test' ? 'Updated' : 'Test';
      await firstNameInput.fill(testValue);

      const saveIndicator = page.getByText('Cambios guardados');
      await expect(saveIndicator).toBeVisible({ timeout: 5000 });

      await page.reload();

      expect(await firstNameInput.inputValue()).toBe(testValue);
    });
  });

  test.describe('Locations Tab', () => {
    test('Create a location', async ({ page, trackedLocations }) => {
      const locationName = uniqueName('LocE2E');
      const locationAddress = '123 Test St';

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.openLocationModal();
      const locationId = await modal.create({ name: locationName, address: locationAddress, instructions: 'Test instructions' });
      trackedLocations.track(locationId);

      const card = page.getByTestId(`location-card-${locationId}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(locationName);
      await expect(card).toContainText(locationAddress);
    });

    test('Create a virtual location', async ({ page, trackedLocations }) => {
      const locationName = uniqueName('VirtLoc');

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.openLocationModal();
      const locationId = await modal.create({ name: locationName, virtual: true });
      trackedLocations.track(locationId);

      const card = page.getByTestId(`location-card-${locationId}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(locationName);
      await expect(card.getByText('Virtual')).toBeVisible();
    });

    test('Edit a location', async ({ page, api, trackedLocations }) => {
      const locationName = uniqueName('EditLoc');
      const location = await api.createLocation({ name: locationName, address: '123 Edit St', instructions: 'Edit me' });
      trackedLocations.track(location.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.editLocation(location.data.id);
      const updatedName = uniqueName('EditLocRenamed');
      const updatedAddress = '456 Renamed St';
      const updatedInstructions = 'Renamed instructions';
      const result = await modal.edit({ name: updatedName, address: updatedAddress, instructions: updatedInstructions });

      expect(result.id).toBe(location.data.id);
      expect(result.name).toBe(updatedName);
      expect(result.address).toBe(updatedAddress);
      expect(result.instructions).toBe(updatedInstructions);

      const card = page.getByTestId(`location-card-${location.data.id}`);
      await expect(card).toContainText(updatedName);
      await expect(card).toContainText(updatedAddress);

      await page.reload();
      await settings.goToLocations();
      const reloadedCard = page.getByTestId(`location-card-${location.data.id}`);
      await expect(reloadedCard).toContainText(updatedName);
      await expect(reloadedCard).toContainText(updatedAddress);

      const fetched = await api.getLocation(location.data.id);
      expect(fetched.data.id).toBe(location.data.id);
      expect(fetched.data.name).toBe(updatedName);
      expect(fetched.data.address).toBe(updatedAddress);
      expect(fetched.data.isDeleted).toBe(false);
    });

    test('Delete a location', async ({ page, api, trackedLocations }) => {
      const locationName = uniqueName('DelLoc');
      const location = await api.createLocation({ name: locationName, address: '123 Del St', instructions: 'Delete me' });
      trackedLocations.track(location.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToLocations();

      const card = page.getByTestId(`location-card-${location.data.id}`);
      await expect(card).toBeVisible();

      const deleteModal = await settings.deleteLocation(location.data.id);
      await deleteModal.confirm();

      await expect(card).not.toBeVisible();

      const fetched = await api.getLocation(location.data.id);
      expect(fetched.data.id).toBe(location.data.id);
      expect(fetched.data.isDeleted).toBe(true);
      expect(fetched.data.deletedAt).toBeTruthy();
    });
  });

  test.describe('Appointment Types Tab', () => {
    test('Create an appointment type', async ({ page, trackedAppointmentTypes }) => {
      const typeName = uniqueName('TypeE2E');

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.openAppointmentTypeModal();
      const typeId = await modal.create({ name: typeName, duration: '60', price: '100' });
      trackedAppointmentTypes.track(typeId);

      const card = page.getByTestId(`appointment-type-card-${typeId}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(typeName);
    });

    test('Edit an appointment type', async ({ page, api, trackedAppointmentTypes }) => {
      const typeName = uniqueName('EditType');
      const apptType = await api.createAppointmentType({ name: typeName, defaultDuration: 60, defaultPrice: 50000 });
      trackedAppointmentTypes.track(apptType.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.editAppointmentType(apptType.data.id);
      const updatedName = uniqueName('EditTypeRenamed');
      const updatedDescription = 'Renamed description';
      const result = await modal.edit({ name: updatedName, duration: '90', description: updatedDescription, price: '75000' });

      expect(result.id).toBe(apptType.data.id);
      expect(result.name).toBe(updatedName);
      expect(result.defaultDuration).toBe(90);
      expect(result.defaultPrice).toBe(75000);
      expect(result.description).toBe(updatedDescription);

      const card = page.getByTestId(`appointment-type-card-${apptType.data.id}`);
      await expect(card).toContainText(updatedName);

      await page.reload();
      await settings.goToAppointmentTypes();
      const reloadedCard = page.getByTestId(`appointment-type-card-${apptType.data.id}`);
      await expect(reloadedCard).toContainText(updatedName);

      const fetched = await api.getAppointmentType(apptType.data.id);
      expect(fetched.data.id).toBe(apptType.data.id);
      expect(fetched.data.name).toBe(updatedName);
      expect(fetched.data.defaultDuration).toBe(90);
      expect(fetched.data.defaultPrice).toBe(75000);
      expect(fetched.data.isDeleted).toBe(false);
    });

    test('Delete an appointment type', async ({ page, api, trackedAppointmentTypes }) => {
      const typeName = uniqueName('DelType');
      const apptType = await api.createAppointmentType({ name: typeName, defaultDuration: 60, defaultPrice: 50000 });
      trackedAppointmentTypes.track(apptType.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAppointmentTypes();

      const card = page.getByTestId(`appointment-type-card-${apptType.data.id}`);
      await expect(card).toBeVisible();

      const deleteModal = await settings.deleteAppointmentType(apptType.data.id);
      await deleteModal.confirm();

      await expect(card).not.toBeVisible();

      const fetched = await api.getAppointmentType(apptType.data.id);
      expect(fetched.data.id).toBe(apptType.data.id);
      expect(fetched.data.isDeleted).toBe(true);
      expect(fetched.data.deletedAt).toBeTruthy();
    });
  });
});
