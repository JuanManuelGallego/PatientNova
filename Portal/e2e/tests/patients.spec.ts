import { test, expect } from '../fixtures';
import { PatientsPage } from '../pages/PatientsPage';
import { PatientModal } from '../pages/Modals/PatientModal';
import { DeletePatientModal } from '../pages/Modals/DeletePatientModal';
import { uniqueName, uniqueEmail } from '../utils/test-data';
import { SidebarPage } from '../pages/SidebarPage';
import { EntityTypes, Routes } from '../utils/const';

test.describe('Patients', () => {
  test('Create patient', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS)

    const patientPage = new PatientsPage(page);
    await patientPage.openCreateModal();

    const name = uniqueName(EntityTypes.PATIENT);
    const email = uniqueEmail();

    const patientModal = new PatientModal(page);
    const patientId = await patientModal.createPatient({ name, lastName: name, email });

    await patientPage.searchPatient(name);
    await patientPage.expectPatientVisible(name);

    await api.deletePatient(patientId);
  });

  test('Edit patient', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS)

    const name = uniqueName(EntityTypes.PATIENT);
    const email = uniqueEmail();

    const patientResponse = await api.createPatient({ name, lastName: name, email });

    const sidebar = new SidebarPage(page);
    await sidebar.navigateToPatients();

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(name);
    await patientPage.expectPatientVisible(name);

    await patientPage.openEditModal(name);
    const editModal = new PatientModal(page);
    await editModal.waitForOpen();

    const newName = uniqueName(EntityTypes.PATIENT);
    await editModal.fillRequiredFields(newName, newName);
    await editModal.submit();

    await patientPage.searchPatient(newName);
    await patientPage.expectPatientVisible(newName);

    await api.deletePatient(patientResponse.data.id);
  });

  test('Delete patient', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS)

    const name = uniqueName(EntityTypes.PATIENT);
    const email = uniqueEmail();

    await api.createPatient({ name, lastName: name, email });

    const sidebar = new SidebarPage(page);
    await sidebar.navigateToPatients();

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(name);
    await patientPage.expectPatientVisible(name);

    await patientPage.openDeleteModal(name);

    const deleteModal = new DeletePatientModal(page);
    await deleteModal.confirm();

    await patientPage.expectPatientNotVisible(name);
  });
});
