import { test, expect } from '../fixtures/test';

test.describe('Patients', () => {
  test.describe('Create', () => {
    test('should create a patient with required fields', async ({ patientsPage }) => {
      const suffix = Date.now();
      const name = `Test${suffix}`;
      const lastName = `Patient${suffix}`;

      const modal = await patientsPage.openCreateModal();
      await modal.createPatient({ name, lastName });

      await patientsPage.waitForLoad();
      await patientsPage.expectPatientVisible(name);
    });

    test('should create a patient with optional fields', async ({ patientsPage }) => {
      const suffix = Date.now();
      const name = `Full${suffix}`;
      const lastName = `Patient${suffix}`;
      const email = `test${suffix}@example.com`;

      const modal = await patientsPage.openCreateModal();
      await modal.createPatient({ name, lastName, email });

      await patientsPage.waitForLoad();
      await patientsPage.expectPatientVisible(name);
    });

    test('should disable submit when required fields are empty', async ({ patientsPage }) => {
      const modal = await patientsPage.openCreateModal();
      await expect(modal.submitButton).toBeDisabled();

      await modal.nameInput.fill('OnlyName');
      await expect(modal.submitButton).toBeDisabled();

      await modal.lastNameInput.fill('OnlyLastName');
      await expect(modal.submitButton).toBeEnabled();
    });

    test('should close modal on cancel', async ({ patientsPage }) => {
      const modal = await patientsPage.openCreateModal();
      await modal.cancel();
      await modal.waitForClose();
    });
  });

  test.describe('Update', () => {
    test('should open edit modal for existing patient', async ({ patientsPage }) => {
      const suffix = Date.now();
      const name = `Edit${suffix}`;
      const lastName = `Patient${suffix}`;

      const createModal = await patientsPage.openCreateModal();
      await createModal.createPatient({ name, lastName });
      await patientsPage.waitForLoad();

      const editModal = await patientsPage.openEditModal(name);
      await expect(editModal.dialog).toHaveAttribute('aria-label', /Editar Paciente/);
      await editModal.cancel();
    });
  });

  test.describe('Delete', () => {
    test('should open delete confirmation modal', async ({ patientsPage }) => {
      const suffix = Date.now();
      const name = `Del${suffix}`;
      const lastName = `Patient${suffix}`;

      const modal = await patientsPage.openCreateModal();
      await modal.createPatient({ name, lastName });
      await patientsPage.waitForLoad();

      const deleteModal = await patientsPage.openDeleteModal(name);
      await expect(deleteModal.dialog).toBeVisible();
      await deleteModal.cancel();
    });
  });

  test.describe('List', () => {
    test('should display patients table', async ({ patientsPage }) => {
      await expect(patientsPage.table).toBeVisible();
    });

    test('should show patient stats', async ({ patientsPage }) => {
      await expect(patientsPage.statTotal).toBeVisible();
      await expect(patientsPage.statActive).toBeVisible();
      await expect(patientsPage.statInactive).toBeVisible();
    });
  });

  test.describe('UI Login', () => {
    test('should create patient after UI login', async ({ loginPage, apiAuth }) => {
      const page = loginPage.page;
      const suffix = Date.now();
      const name = `UILogin${suffix}`;
      const lastName = `Patient${suffix}`;

      await loginPage.login(apiAuth.email, apiAuth.password);

      const { PatientsPage } = await import('../pages/PatientsPage');
      const patientsPage = new PatientsPage(page);
      await patientsPage.goto('/patients');
      await patientsPage.waitForLoad();

      const modal = await patientsPage.openCreateModal();
      await modal.createPatient({ name, lastName });

      await patientsPage.waitForLoad();
      await patientsPage.expectPatientVisible(name);
    });
  });
});
