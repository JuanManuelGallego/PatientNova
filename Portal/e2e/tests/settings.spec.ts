import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages/SettingsPage';
import { AuditDrawer } from '../pages/Drawers/AuditDrawer';
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

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.openLocationModal();
      const locationId = await modal.create({ name: locationName, address: '123 Test St', instructions: 'Test instructions' });
      trackedLocations.track(locationId);

      const locationCard = page.getByText(locationName);
      await expect(locationCard).toBeVisible();
    });

    test('Create a virtual location', async ({ page, trackedLocations }) => {
      const locationName = uniqueName('VirtLoc');

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.openLocationModal();
      const locationId = await modal.create({ name: locationName, virtual: true });
      trackedLocations.track(locationId);

      const locationCard = page.getByText(locationName);
      await expect(locationCard).toBeVisible();
    });

    test('Delete a location', async ({ page, api, trackedLocations }) => {
      const locationName = uniqueName('DelLoc');
      const location = await api.createLocation({ name: locationName, address: '123 Del St', instructions: 'Delete me' });
      trackedLocations.track(location.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToLocations();

      const locationCard = page.getByText(locationName);
      await expect(locationCard).toBeVisible();

      const deleteModal = await settings.deleteLocation(location.data.id);
      await deleteModal.confirm();

      await expect(locationCard).not.toBeVisible();
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

      const typeCard = page.getByText(typeName);
      await expect(typeCard).toBeVisible();
    });

    test('Delete an appointment type', async ({ page, api, trackedAppointmentTypes }) => {
      const typeName = uniqueName('DelType');
      const apptType = await api.createAppointmentType({ name: typeName, defaultDuration: 60, defaultPrice: 50000 });
      trackedAppointmentTypes.track(apptType.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAppointmentTypes();

      const typeCard = page.getByText(typeName);
      await expect(typeCard).toBeVisible();

      const deleteModal = await settings.deleteAppointmentType(apptType.data.id);
      await deleteModal.confirm();

      await expect(typeCard).not.toBeVisible();
    });
  });
});
