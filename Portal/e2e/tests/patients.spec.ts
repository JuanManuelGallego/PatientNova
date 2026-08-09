import { test, expect } from '../fixtures';
import { PatientsPage } from '../pages/PatientsPage';
import { PatientModal } from '../pages/Modals/PatientModal';
import { DeletePatientModal } from '../pages/Modals/DeletePatientModal';
import { uniqueName, uniqueEmail, uniquePhoneNumber, randomString } from '../utils/test-data';
import { SidebarPage } from '../pages/SidebarPage';
import { APPT_TYPE_NAME, EntityTypes, Routes } from '../utils/const';

test.describe('Patients', () => {
  test('Create patient', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS)

    const patientPage = new PatientsPage(page);
    const patientModal = await patientPage.openCreateModal();

    const name = uniqueName(EntityTypes.PATIENT);
    const number = uniquePhoneNumber();

    const patientId = await patientModal.createPatient({
      name,
      lastName: name,
      email: uniqueEmail(),
      whatsapp: number,
      sms: number,
      appointmentType: APPT_TYPE_NAME,
      notes: randomString(100)
    });


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

    const editModal = await patientPage.openEditModal(name);

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

    const deleteModal = await patientPage.openDeleteModal(name);
    await deleteModal.confirm();

    await patientPage.expectPatientNotVisible(name);
  });

  test('Open patient drawer and edit from drawer', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS);

    const name = uniqueName(EntityTypes.PATIENT);
    const email = uniqueEmail();
    const phone = uniquePhoneNumber();

    const patientResponse = await api.createPatient({ name, lastName: name, email, whatsappNumber: phone, smsNumber: phone, notes: randomString(50) });

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(name);
    await patientPage.expectPatientVisible(name);

    const drawer = await patientPage.openDrawer(name);
    await drawer.expectSection('Información de Contacto');
    await expect(drawer.panel.getByText(email)).toBeVisible();
    await expect(drawer.panel.getByText(phone).first()).toBeVisible();
    await drawer.expectSection('Información Adicional');
    await drawer.expectSection('Información del sistema');

    await drawer.edit();
    const editModal = new PatientModal(page);
    await editModal.waitForOpen();

    const newName = uniqueName(EntityTypes.PATIENT);
    await editModal.fillRequiredFields(newName, newName);
    await editModal.submit();
    await editModal.waitForClose();

    await patientPage.searchPatient(newName);
    await patientPage.expectPatientVisible(newName);

    await api.deletePatient(patientResponse.data.id);
  });

  test('Delete patient from drawer', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS);

    const name = uniqueName(EntityTypes.PATIENT);
    const email = uniqueEmail();
    const phone = uniquePhoneNumber();
    const notes = randomString(50);

    await api.createPatient({ name, lastName: name, email, whatsappNumber: phone, smsNumber: phone, notes });

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(name);
    await patientPage.expectPatientVisible(name);

    const drawer = await patientPage.openDrawer(name);
    await expect(drawer.panel.getByText(name)).toBeVisible();
    await expect(drawer.panel.getByText(email)).toBeVisible();
    await expect(drawer.panel.getByText(phone).first()).toBeVisible();
    await expect(drawer.panel.getByText(notes)).toBeVisible();

    await drawer.delete();

    const deleteModal = new DeletePatientModal(page);
    await deleteModal.confirm();

    await patientPage.expectPatientNotVisible(name);
  });
});
