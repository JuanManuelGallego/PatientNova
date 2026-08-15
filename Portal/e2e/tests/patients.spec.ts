import { test, expect } from '../fixtures';
import { PatientsPage } from '../pages/PatientsPage';
import { PatientModal } from '../pages/Modals/PatientModal';
import { DeletePatientModal } from '../pages/Modals/DeletePatientModal';
import { uniqueName, uniqueEmail, uniquePhoneNumber, randomString } from '../utils/test-data';
import { EntityTypes, Routes } from '../utils/const';
import { createTestPatient } from '../utils/helpers';
import { Env } from '../utils/env';

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
      appointmentType: Env.apptTypeName,
      notes: randomString(100)
    });


    await patientPage.searchPatient(name);
    await patientPage.expectPatientVisible(name);

    await api.deletePatient(patientId);
  });

  test('Edit patient', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS)

    const patient = await createTestPatient(api);

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(patient.name);
    await patientPage.expectPatientVisible(patient.name);

    const editModal = await patientPage.openEditModal(patient.name);

    const newName = uniqueName(EntityTypes.PATIENT);
    await editModal.fillRequiredFields(newName, newName);
    await editModal.submit();

    await patientPage.searchPatient(newName);
    await patientPage.expectPatientVisible(newName);

    await api.deletePatient(patient.id);
  });

  test('Delete patient', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS)

    const patient = await createTestPatient(api);

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(patient.name);
    await patientPage.expectPatientVisible(patient.name);

    const deleteModal = await patientPage.openDeleteModal(patient.name);
    await deleteModal.confirm();

    await patientPage.expectPatientNotVisible(patient.name);
  });

  test('Open patient drawer and edit from drawer', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS);

    const phone = uniquePhoneNumber();
    const patient = await createTestPatient(api, { whatsappNumber: phone, smsNumber: phone, notes: randomString(50) });

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(patient.name);
    await patientPage.expectPatientVisible(patient.name);

    const drawer = await patientPage.openDrawer(patient.name);
    await drawer.expectSection('Información de Contacto');
    await expect(drawer.whatsappNumber).toContainText(phone);
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

    await api.deletePatient(patient.id);
  });

  test('Delete patient from drawer', async ({ page, api }) => {
    await page.goto(Routes.PATIENTS);

    const phone = uniquePhoneNumber();
    const notes = randomString(50);

    const patient = await createTestPatient(api, { whatsappNumber: phone, smsNumber: phone, notes });

    const patientPage = new PatientsPage(page);
    await patientPage.searchPatient(patient.name);
    await patientPage.expectPatientVisible(patient.name);

    const drawer = await patientPage.openDrawer(patient.name);
    await expect(drawer.panel.getByText(patient.name)).toBeVisible();
    await expect(drawer.whatsappNumber).toContainText(phone);
    await expect(drawer.panel.getByText(notes)).toBeVisible();

    await drawer.delete();

    const deleteModal = new DeletePatientModal(page);
    await deleteModal.confirm();

    await patientPage.expectPatientNotVisible(patient.name);
  });
});
