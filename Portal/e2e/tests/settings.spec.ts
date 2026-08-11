import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages/SettingsPage';
import { DeleteLocationModal } from '../pages/Modals/DeleteLocationModal';
import { DeleteAppointmentTypeModal } from '../pages/Modals/DeleteAppointmentTypeModal';
import { AuditDrawer } from '../pages/Drawers/AuditDrawer';
import { uniqueName } from '../utils/test-data';
import { Routes } from '../utils/const';

test.describe('Settings', () => {
  test.describe('Navigation', () => {
    test('Navigate between all tabs', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);

      await settings.goToProfile();
      await expect(settings.tabProfile).toHaveAttribute('aria-selected', 'true');

      await settings.goToSecurity();
      await expect(settings.tabSecurity).toHaveAttribute('aria-selected', 'true');

      await settings.goToLocations();
      await expect(settings.tabLocations).toHaveAttribute('aria-selected', 'true');

      await settings.goToAppointmentTypes();
      await expect(settings.tabAppointmentTypes).toHaveAttribute('aria-selected', 'true');

      await settings.goToReminders();
      await expect(settings.tabReminders).toHaveAttribute('aria-selected', 'true');

      await settings.goToAuditLogs();
      await expect(settings.tabAuditLogs).toHaveAttribute('aria-selected', 'true');
    });

    test('Persist tab in URL query', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToSecurity();
      await expect(page).toHaveURL(/tab=Seguridad/);
    });
  });

  test.describe('Profile Tab', () => {
    test('Display profile tab by default', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await expect(settings.tabProfile).toHaveAttribute('aria-selected', 'true');
    });

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

      const saveIndicator = page.getByText(/Guardado|guardado/i);
      await expect(saveIndicator).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Security Tab', () => {
    test('Switch to security tab', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToSecurity();
      await expect(settings.tabSecurity).toHaveAttribute('aria-selected', 'true');
    });

    test('Display password change form', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToSecurity();

      await expect(page.getByTestId('security-current-password-input')).toBeVisible();
      await expect(page.getByTestId('security-new-password-input')).toBeVisible();
      await expect(page.getByTestId('security-confirm-password-input')).toBeVisible();
    });

    test('Show password rules while typing', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToSecurity();

      const newPasswordInput = page.getByTestId('security-new-password-input');
      await newPasswordInput.fill('weak');

      const rules = page.getByTestId('password-rules');
      await expect(rules).toBeVisible();
    });

    test('Validate password mismatch', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToSecurity();

      const newPasswordInput = page.getByTestId('security-new-password-input');
      const confirmInput = page.getByTestId('security-confirm-password-input');

      await newPasswordInput.fill('StrongPass1!');
      await confirmInput.fill('DifferentPass1!');

      const mismatchMessage = page.getByText(/Las contraseñas no coinciden/i);
      await expect(mismatchMessage).toBeVisible();
    });
  });

  test.describe('Locations Tab', () => {
    test('Display locations tab', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToLocations();
      await expect(settings.tabLocations).toHaveAttribute('aria-selected', 'true');
    });

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

    test('Require address for non-virtual location', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      const modal = await settings.openLocationModal();

      await modal.nameInput.fill(uniqueName('NoAddr'));
      await modal.virtualCheckbox.uncheck();
      await modal.submitButton.click();

      await expect(modal.dialog).toBeVisible();
      await modal.cancel();
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

      const deleteBtn = locationCard.locator('..').getByTestId('location-delete-button');
      await deleteBtn.click();

      const deleteModal = new DeleteLocationModal(page);
      await deleteModal.confirm();

      await expect(locationCard).not.toBeVisible();
    });

    test('Show empty state when no locations', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToLocations();

      const hasCards = (await page.getByTestId('location-card').count()) > 0;
      if (!hasCards) {
        await expect(page.getByText(/Sin ubicaciones configuradas/i)).toBeVisible();
      }
    });
  });

  test.describe('Appointment Types Tab', () => {
    test('Display appointment types tab', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAppointmentTypes();
      await expect(settings.tabAppointmentTypes).toHaveAttribute('aria-selected', 'true');
    });

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

      const deleteBtn = typeCard.locator('..').getByTestId('appointment-type-delete-button');
      await deleteBtn.click();

      const deleteModal = new DeleteAppointmentTypeModal(page);
      await deleteModal.confirm();

      await expect(typeCard).not.toBeVisible();
    });

    test('Show empty state when no appointment types', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAppointmentTypes();

      const hasCards = (await page.getByTestId('appointment-type-card').count()) > 0;
      if (!hasCards) {
        await expect(page.getByText(/Sin tipos de cita configurados/i)).toBeVisible();
      }
    });
  });

  test.describe('Reminders Settings Tab', () => {
    test('Toggle reminder channel', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToReminders();

      const channelSelector = page.getByTestId('reminders-channel-selector');
      await expect(channelSelector).toBeVisible();
      await channelSelector.click();

      const smsOption = page.getByRole('option', { name: /sms/i });
      await expect(smsOption).toBeVisible();
      await smsOption.click();
    });

    test('Toggle reminder active status', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToReminders();

      const toggle = page.getByTestId('reminders-active-toggle');
      await expect(toggle).toBeVisible();

      const checkbox = toggle.locator('input[type="checkbox"]');
      await checkbox.click();

      await expect(page.getByText(/Preferencias de recordatorios actualizadas/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Audit Logs Tab', () => {
    test('Display audit logs', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAuditLogs();

      await expect(page.getByRole('table')).toBeVisible();
    });

    test('Filter audit logs by entity', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAuditLogs();

      const entityFilter = page.getByTestId('audit-entity-filter');
      await expect(entityFilter).toBeVisible();
      await entityFilter.click();

      const firstOption = page.getByRole('option').first();
      await expect(firstOption).toBeVisible();
      await firstOption.click();

      await page.waitForTimeout(500);
    });

    test('Open audit drawer', async ({ page }) => {
      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAuditLogs();

      const firstRow = page.getByRole('row').nth(1);
      await expect(firstRow).toBeVisible();
      await firstRow.click();

      const drawer = new AuditDrawer(page);
      await drawer.waitForOpen();
      await expect(drawer.panel).toBeVisible();
      await drawer.close();
    });
  });
});
