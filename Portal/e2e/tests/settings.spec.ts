import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages/SettingsPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { uniqueName, uniqueEmail, randomString } from '../utils/test-data';
import { Routes } from '../utils/const';

interface AuditRecord {
  id: string;
  entityId: string;
  description: string;
  actorDisplayName: string;
  actionType: string;
  entityType: string;
  source: string;
}

function auditEndpointMatches(url: string, params: Record<string, string>): boolean {
  if (!url.includes('/audit-logs')) return false;
  const sp = new URL(url).searchParams;
  return Object.entries(params).every(([k, v]) => sp.get(k) === v);
}

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

  test.describe('Audit Logs Tab', () => {
    test('Filter by search, entity type, and action type', async ({ page, api, trackedPatients, trackedLocations }) => {
      const prefix = `AuditFlt-${Date.now().toString(36)}`;
      const patientName = `${prefix}-P`;
      const patient = await api.createPatient({ name: patientName, lastName: patientName, email: uniqueEmail() });
      trackedPatients.track(patient.data.id);

      const locName = `${prefix}-L`;
      const location = await api.createLocation({ name: locName, address: '1 Test St', instructions: randomString()  });
      trackedLocations.track(location.data.id);

      const locAudits = await api.getAuditLogs({ entityId: location.data.id });
      const locAuditId = (locAudits.data as unknown as AuditRecord[])[0]?.id;

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAuditLogs();
      const auditPage = new AuditLogsPage(page);

      const responsePromise = page.waitForResponse((r) =>
        auditEndpointMatches(r.url(), {
          entityType: 'PATIENT',
          actionType: 'CREATE',
          search: patientName,
        }),
      );

      await auditPage.search(patientName);
      await auditPage.selectEntityFilter('Paciente');
      await auditPage.selectActionFilter('Creación');

      const response = await responsePromise;
      expect(response.status()).toBe(200);

      await auditPage.expectRowVisibleByDescription(patientName);
      if (locAuditId) {
        await auditPage.expectRowNotVisible(locAuditId);
      }
    });

    test('Paginate across two pages', async ({ page, api, trackedPatients }) => {
      const prefix = `AuditPag-${Date.now().toString(36)}`;
      const names: string[] = [];
      for (let i = 0; i < 12; i++) {
        const name = `${prefix}-${String(i).padStart(2, '0')}`;
        names.push(name);
        const patient = await api.createPatient({ name, lastName: name, email: uniqueEmail() });
        trackedPatients.track(patient.data.id);
      }

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAuditLogs();
      const auditPage = new AuditLogsPage(page);

      await auditPage.search(prefix);
      await auditPage.selectEntityFilter('Paciente');
      await auditPage.selectActionFilter('Creación');

      await page.waitForResponse((r) =>
        auditEndpointMatches(r.url(), {
          search: prefix,
          entityType: 'PATIENT',
          actionType: 'CREATE',
        }),
      );

      const table = page.getByTestId('audit-table');
      await expect(table.locator('tbody tr')).toHaveCount(10);
      await expect(page.getByTestId('audit-pagination-count')).toContainText('de 12 registros');

      await auditPage.goToNextPage();
      await page.waitForResponse(
        (r) => r.url().includes('/audit-logs') && new URL(r.url()).searchParams.get('page') === '2',
      );

      await expect(table.locator('tbody tr')).toHaveCount(2);
      // Oldest created (index 0) lands on page two due to desc ordering.
      await expect(table).toContainText(names[0]);
      // Newest created (index 11) is on page one, not page two.
      await expect(table).not.toContainText(names[11]);

      await auditPage.goToPreviousPage();
      await page.waitForResponse(
        (r) => r.url().includes('/audit-logs') && new URL(r.url()).searchParams.get('page') === '1',
      );
      await expect(table.locator('tbody tr')).toHaveCount(10);
    });

    test('Open row drawer and verify details', async ({ page, api, trackedPatients }) => {
      const prefix = `AuditDrw-${Date.now().toString(36)}`;
      const patientName = `${prefix}-P`;
      const patient = await api.createPatient({ name: patientName, lastName: patientName, email: uniqueEmail() });
      trackedPatients.track(patient.data.id);

      await page.goto(Routes.SETTINGS);

      const settings = new SettingsPage(page);
      await settings.goToAuditLogs();
      const auditPage = new AuditLogsPage(page);

      await auditPage.search(patientName);
      await auditPage.selectEntityFilter('Paciente');
      await auditPage.selectActionFilter('Creación');
      await page.waitForResponse(
        (r) => r.url().includes('/audit-logs') && new URL(r.url()).searchParams.get('search') === patientName,
      );

      const drawer = await auditPage.openRowByDescription(patientName);
      await drawer.expectVisible();
      await drawer.expectAction('Creación');
      await drawer.expectEntityType('Paciente');
      await drawer.expectEntityId(patient.data.id);
      await drawer.expectSource('API');
      await drawer.close();
      await drawer.expectNotVisible();
    });
  });
});
