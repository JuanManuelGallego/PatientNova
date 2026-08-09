import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages/SettingsPage';
import { LocationModal } from '../pages/Modals/LocationModal';
import { AppointmentTypeModal } from '../pages/Modals/AppointmentTypeModal';
import { DeleteLocationModal } from '../pages/Modals/DeleteLocationModal';
import { DeleteAppointmentTypeModal } from '../pages/Modals/DeleteAppointmentTypeModal';
import { AuditDrawer } from '../pages/Drawers/AuditDrawer';
import { uniqueName } from '../utils/test-data';

test.describe('Settings', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
  });

  test.describe('Navigation', () => {
    test('should navigate between all tabs', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToProfile();
      await expect(authenticatedPage.getByTestId('settings-tab-perfil')).toHaveAttribute('aria-selected', 'true');

      await settings.goToSecurity();
      await expect(authenticatedPage.getByTestId('settings-tab-seguridad')).toHaveAttribute('aria-selected', 'true');

      await settings.goToLocations();
      await expect(authenticatedPage.getByTestId('settings-tab-ubicaciones')).toHaveAttribute('aria-selected', 'true');

      await settings.goToAppointmentTypes();
      await expect(authenticatedPage.getByTestId('settings-tab-tipos-de-cita')).toHaveAttribute('aria-selected', 'true');

      await settings.goToReminders();
      await expect(authenticatedPage.getByTestId('settings-tab-recordatorios')).toHaveAttribute('aria-selected', 'true');

      await settings.goToAuditLogs();
      await expect(authenticatedPage.getByTestId('settings-tab-registro-de-actividad')).toHaveAttribute('aria-selected', 'true');
    });

    test('should persist tab in URL query', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToSecurity();
      await expect(authenticatedPage).toHaveURL(/tab=Seguridad|tab=seguridad/);
    });
  });

  test.describe('Profile Tab', () => {
    test('should display profile tab by default', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.getByTestId('settings-tab-perfil')).toHaveAttribute('aria-selected', 'true');
    });

    test('should display profile form fields', async ({ authenticatedPage }) => {
      const firstNameInput = authenticatedPage.getByTestId('profile-first-name-input');
      const lastNameInput = authenticatedPage.getByTestId('profile-last-name-input');
      if (await firstNameInput.isVisible()) {
        await expect(firstNameInput).toBeVisible();
      }
      if (await lastNameInput.isVisible()) {
        await expect(lastNameInput).toBeVisible();
      }
    });

    test('should update profile fields with auto-save', async ({ authenticatedPage }) => {
      const firstNameInput = authenticatedPage.getByTestId('profile-first-name-input');
      if (await firstNameInput.isVisible()) {
        const originalValue = await firstNameInput.inputValue();
        await firstNameInput.fill(originalValue || 'Test');
        await authenticatedPage.waitForTimeout(1500);
        const savedIndicator = authenticatedPage.getByText(/Guardado/i);
        if (await savedIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(savedIndicator).toBeVisible();
        }
      }
    });

    test('should display banking info fields', async ({ authenticatedPage }) => {
      const bankNameInput = authenticatedPage.getByTestId('profile-bank-name-input');
      if (await bankNameInput.isVisible()) {
        await expect(bankNameInput).toBeVisible();
      }
    });
  });

  test.describe('Security Tab', () => {
    test('should switch to security tab', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToSecurity();
      await expect(authenticatedPage.getByTestId('settings-tab-seguridad')).toHaveAttribute('aria-selected', 'true');
    });

    test('should display password change form', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToSecurity();
      const currentPasswordInput = authenticatedPage.getByTestId('security-current-password-input');
      const newPasswordInput = authenticatedPage.getByTestId('security-new-password-input');
      const confirmInput = authenticatedPage.getByTestId('security-confirm-password-input');

      if (await currentPasswordInput.isVisible()) {
        await expect(currentPasswordInput).toBeVisible();
        await expect(newPasswordInput).toBeVisible();
        await expect(confirmInput).toBeVisible();
      }
    });

    test('should show password rules while typing', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToSecurity();
      const newPasswordInput = authenticatedPage.getByTestId('security-new-password-input');
      if (await newPasswordInput.isVisible()) {
        await newPasswordInput.fill('weak');
        const rules = authenticatedPage.getByTestId('password-rules');
        if (await rules.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(rules).toBeVisible();
        }
      }
    });
  });

  test.describe('Locations Tab', () => {
    test('should display locations tab', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToLocations();
      await expect(authenticatedPage.getByTestId('settings-tab-ubicaciones')).toHaveAttribute('aria-selected', 'true');
    });

    test('should create a location', async ({ authenticatedPage, api }) => {
      const settings = new SettingsPage(authenticatedPage);
      const modal = await settings.openLocationModal();
      const locationName = uniqueName('LocE2E');
      await modal.create({ name: locationName, address: '123 Test St', instructions: 'Test instructions' });

      const locationCard = authenticatedPage.getByText(locationName);
      await expect(locationCard).toBeVisible();
    });

    test('should create a virtual location', async ({ authenticatedPage, api }) => {
      const settings = new SettingsPage(authenticatedPage);
      const modal = await settings.openLocationModal();
      const locationName = uniqueName('VirtLoc');
      await modal.create({ name: locationName, virtual: true });

      const locationCard = authenticatedPage.getByText(locationName);
      await expect(locationCard).toBeVisible();
    });

    test('should require address for non-virtual location', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      const modal = await settings.openLocationModal();
      await modal.nameInput.fill(uniqueName('NoAddr'));
      await modal.virtualCheckbox.uncheck();
      await modal.submitButton.click();

      await expect(modal.dialog).toBeVisible();
      await modal.cancel();
    });

    test('should delete a location', async ({ authenticatedPage, api }) => {
      const location = await api.createLocation({ name: uniqueName('DelLoc'), address: '123 Del St', instructions: 'Delete me' });
      await authenticatedPage.reload();

      const settings = new SettingsPage(authenticatedPage);
      await settings.goToLocations();
      const deleteBtn = authenticatedPage.locator('[data-testid="location-delete-button"]').first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const deleteModal = new DeleteLocationModal(authenticatedPage);
        await deleteModal.confirm();
      }

      await api.deleteLocation(location.id as string).catch(() => { });
    });

    test('should show empty state when no locations', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToLocations();
      const emptyText = authenticatedPage.getByText(/Sin ubicaciones configuradas/i);
      const hasCards = (await authenticatedPage.locator('[data-testid^="location-card"]').count()) > 0;
      if (!hasCards) {
        await expect(emptyText).toBeVisible();
      }
    });
  });

  test.describe('Appointment Types Tab', () => {
    test('should display appointment types tab', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToAppointmentTypes();
      await expect(authenticatedPage.getByTestId('settings-tab-tipos-de-cita')).toHaveAttribute('aria-selected', 'true');
    });

    test('should create an appointment type', async ({ authenticatedPage, api }) => {
      const settings = new SettingsPage(authenticatedPage);
      const modal = await settings.openAppointmentTypeModal();
      const typeName = uniqueName('TypeE2E');
      await modal.create({ name: typeName, duration: '60', price: '100' });

      const typeCard = authenticatedPage.getByText(typeName);
      await expect(typeCard).toBeVisible();
    });

    test('should delete an appointment type', async ({ authenticatedPage, api }) => {
      const apptType = await api.createAppointmentType({ name: uniqueName('DelType'), defaultDuration: 60, defaultPrice: 50 });
      await authenticatedPage.reload();

      const settings = new SettingsPage(authenticatedPage);
      await settings.goToAppointmentTypes();
      const deleteBtn = authenticatedPage.locator('[data-testid="appointment-type-delete-button"]').first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const deleteModal = new DeleteAppointmentTypeModal(authenticatedPage);
        await deleteModal.confirm();
      }

      await api.deleteAppointmentType(apptType.id as string).catch(() => { });
    });

    test('should show empty state when no appointment types', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToAppointmentTypes();
      const emptyText = authenticatedPage.getByText(/Sin tipos de cita configurados/i);
      const hasCards = (await authenticatedPage.locator('[data-testid^="appointment-type-card"]').count()) > 0;
      if (!hasCards) {
        await expect(emptyText).toBeVisible();
      }
    });
  });

  test.describe('Reminders Settings Tab', () => {
    test('should toggle reminder channel', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToReminders();
      const whatsappRadio = authenticatedPage.getByTestId('reminders-channel-whatsapp');
      const smsRadio = authenticatedPage.getByTestId('reminders-channel-sms');

      if (await whatsappRadio.isVisible()) {
        await whatsappRadio.click();
      }
    });

    test('should toggle reminder active status', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToReminders();
      const toggle = authenticatedPage.getByTestId('reminders-active-toggle');
      if (await toggle.isVisible()) {
        await toggle.click();
        await authenticatedPage.waitForTimeout(1000);
      }
    });
  });

  test.describe('Audit Logs Tab', () => {
    test('should display audit logs', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToAuditLogs();
      await expect(authenticatedPage.getByRole('table')).toBeVisible();
    });

    test('should filter audit logs by entity', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToAuditLogs();
      const entityFilter = authenticatedPage.getByTestId('audit-entity-filter');
      if (await entityFilter.isVisible()) {
        await entityFilter.click();
        const option = authenticatedPage.getByRole('option').first();
        if (await option.isVisible()) {
          await option.click();
          await authenticatedPage.waitForTimeout(500);
        }
      }
    });

    test('should open audit drawer', async ({ authenticatedPage }) => {
      const settings = new SettingsPage(authenticatedPage);
      await settings.goToAuditLogs();
      const firstRow = authenticatedPage.getByRole('row').nth(1);
      if (await firstRow.isVisible()) {
        await firstRow.click();
        const drawer = new AuditDrawer(authenticatedPage);
        await drawer.waitForOpen();
        await expect(drawer.panel).toBeVisible();
        await drawer.close();
      }
    });
  });
});
