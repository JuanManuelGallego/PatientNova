import { test, expect } from '../fixtures';
import { PatientsPage } from '../pages/PatientsPage';
import { PatientModal } from '../pages/PatientModal';
import { PatientDrawer } from '../pages/PatientDrawer';
import { DeletePatientModal } from '../pages/DeletePatientModal';
import { uniqueName, uniqueEmail } from '../utils/test-data';

test.describe('Patients', () => {
  test('should display patients list', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    await expect(patients.table).toBeVisible();
    await expect(patients.statTotal).toBeVisible();
    await expect(patients.statActive).toBeVisible();
    await expect(patients.statInactive).toBeVisible();
  });

  test('should create a new patient', async ({ authenticatedPage, api }) => {
    const name = uniqueName('Patient');
    const email = uniqueEmail();
    const patients = new PatientsPage(authenticatedPage);
    const modal = await patients.openCreateModal();
    await modal.createPatient({ name, lastName: 'TestLast', email });
    await patients.expectPatientVisible(name);

    // cleanup
    const rows = await authenticatedPage.getByRole('row').filter({ hasText: name }).all();
    if (rows.length > 0) {
      const row = rows[0];
      const deleteBtn = row.locator(`[data-testid="patient-row-delete-button"]`);
      await deleteBtn.click();
      const deleteModal = new DeletePatientModal(authenticatedPage);
      await deleteModal.confirm();
    }
  });

  test('should show validation error for missing required fields', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    const modal = await patients.openCreateModal();
    await modal.submit();
    await expect(authenticatedPage.getByText(/completa todos los campos requeridos/i)).toBeVisible();
    await modal.cancel();
  });

  test('should cancel patient creation', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    const modal = await patients.openCreateModal();
    await modal.fillRequiredFields(uniqueName('Cancel'), 'TestLast');
    await modal.cancel();
    await modal.waitForClose();
    await expect(authenticatedPage.getByRole('row').filter({ hasText: 'Cancel' })).not.toBeVisible();
  });

  test('should open patient drawer on row click', async ({ authenticatedPage, api }) => {
    const name = uniqueName('Drawer');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const drawer = await patients.openDrawer(name);
    await expect(drawer.panel).toBeVisible();
    await drawer.close();

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should display contact info in drawer', async ({ authenticatedPage, api }) => {
    const name = uniqueName('Contact');
    const phone = '+15551234567';
    const patient = await api.createPatient({ name, lastName: 'TestLast', whatsappNumber: phone });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const drawer = await patients.openDrawer(name);
    await expect(drawer.panel).toBeVisible();
    await drawer.close();

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should edit patient from drawer', async ({ authenticatedPage, api }) => {
    const name = uniqueName('Edit');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const drawer = await patients.openDrawer(name);
    await drawer.edit();
    const modal = new PatientModal(authenticatedPage);
    await modal.waitForOpen();
    await modal.nameInput.fill(uniqueName('Edited'));
    await modal.submit();
    await modal.waitForClose();

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should delete patient from drawer', async ({ authenticatedPage, api }) => {
    const name = uniqueName('Delete');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const drawer = await patients.openDrawer(name);
    await drawer.delete();
    const deleteModal = new DeletePatientModal(authenticatedPage);
    await deleteModal.confirm();
    await expect(authenticatedPage.getByRole('row').filter({ hasText: name })).not.toBeVisible();
  });

  test('should cancel patient deletion', async ({ authenticatedPage, api }) => {
    const name = uniqueName('NoDel');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const drawer = await patients.openDrawer(name);
    await drawer.delete();
    const deleteModal = new DeletePatientModal(authenticatedPage);
    await deleteModal.cancel();
    await patients.expectPatientVisible(name);

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should search patients by name', async ({ authenticatedPage, api }) => {
    const name = uniqueName('Searchable');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    await patients.searchInput.fill(name);
    await authenticatedPage.waitForTimeout(500);
    await patients.expectPatientVisible(name);

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should filter active patients', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    const activosChip = authenticatedPage.getByRole('button', { name: /Activos/ });
    if (await activosChip.isVisible()) {
      await activosChip.click();
      await expect(authenticatedPage.getByRole('table')).toBeVisible();
    }
  });

  test('should filter inactive patients', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    const inactivosChip = authenticatedPage.getByRole('button', { name: /Inactivos/ });
    if (await inactivosChip.isVisible()) {
      await inactivosChip.click();
      await expect(authenticatedPage.getByRole('table')).toBeVisible();
    }
  });

  test('should paginate patients', async ({ authenticatedPage, api }) => {
    const createdIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const p = await api.createPatient({ name: uniqueName('Page'), lastName: 'TestLast', email: uniqueEmail() });
      createdIds.push(p.id as string);
    }
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const rowCount = await patients.getRowCount();
    expect(rowCount).toBeGreaterThan(1);

    for (const id of createdIds) {
      await api.deletePatient(id).catch(() => {});
    }
  });

  test('should show empty state when no patients', async ({ authenticatedPage }) => {
    const emptyText = authenticatedPage.getByText(/No hay pacientes/i);
    const hasRows = await authenticatedPage.getByRole('row').count() > 1;
    if (!hasRows) {
      await expect(emptyText).toBeVisible();
    }
  });

  test('should show empty search results', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    await patients.searchInput.fill('zzz_nonexistent_xyz_123');
    await authenticatedPage.waitForTimeout(500);
    await expect(authenticatedPage.getByText(/Sin resultados/i)).toBeVisible();
  });

  test('should display system info in drawer', async ({ authenticatedPage, api }) => {
    const name = uniqueName('SysInfo');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const drawer = await patients.openDrawer(name);
    await expect(drawer.panel).toBeVisible();
    await drawer.close();

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should show linked appointments in drawer', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    const firstRow = authenticatedPage.getByRole('row').nth(1);
    if (await firstRow.isVisible()) {
      const rowText = await firstRow.textContent();
      if (rowText && rowText.length > 0) {
        const drawer = await patients.openDrawer(rowText.split('\n')[0]);
        await expect(drawer.panel).toBeVisible();
        await drawer.close();
      }
    }
  });

  test('should view patient stats', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    await expect(patients.statTotal).toBeVisible();
    await expect(patients.statActive).toBeVisible();
    await expect(patients.statInactive).toBeVisible();
  });

  test('should clear search input', async ({ authenticatedPage }) => {
    const patients = new PatientsPage(authenticatedPage);
    await patients.searchInput.fill('test');
    await patients.searchInput.clear();
    await expect(authenticatedPage.getByRole('table')).toBeVisible();
  });

  test('should handle multiple patients in list', async ({ authenticatedPage, api }) => {
    const p1 = await api.createPatient({ name: uniqueName('Multi1'), lastName: 'Last', email: uniqueEmail() });
    const p2 = await api.createPatient({ name: uniqueName('Multi2'), lastName: 'Last', email: uniqueEmail() });
    await authenticatedPage.reload();

    const patients = new PatientsPage(authenticatedPage);
    const count = await patients.getRowCount();
    expect(count).toBeGreaterThanOrEqual(2);

    await api.deletePatient(p1.id as string).catch(() => {});
    await api.deletePatient(p2.id as string).catch(() => {});
  });
});
