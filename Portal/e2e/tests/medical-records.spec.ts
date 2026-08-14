import { test, expect } from '../fixtures';
import { MedicalRecordsPage } from '../pages/MedicalRecordsPage';
import { Routes, HttpMethods } from '../utils/const';
import { createTestPatient, createTestMedicalRecord } from '../utils/helpers';
import { randomString } from '../utils/test-data';

test.describe('Medical Records', () => {
  test('Show empty state when no patient selected', async ({ page }) => {
    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await expect(medicalRecordsPage.patientInput).toBeVisible();
    await medicalRecordsPage.expectCreateButtonsHidden();
    await expect(medicalRecordsPage.patientInput).toHaveValue('');
  });

  test('Show create buttons after selecting patient with no record', async ({ page, api }) => {
    const patient = await createTestPatient(api);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectCreateButtonsVisible();
    await medicalRecordsPage.expectEmptyState();

    await api.deletePatient(patient.id);
  });

  test('Create individual medical record', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);

    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/medical-records'),
    );

    await medicalRecordsPage.createIndividual();
    const response = await createResponse;
    expect(response.ok()).toBeTruthy();

    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectAntecedentsVisible();
    await medicalRecordsPage.expectDownloadPdfVisible();
  });

  test('Create family medical record', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);

    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.POST &&
        response.url().includes('/medical-records'),
    );

    await medicalRecordsPage.createFamily();
    const response = await createResponse;
    expect(response.ok()).toBeTruthy();

    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectFamilySpecificVisible();
    await medicalRecordsPage.expectDownloadPdfVisible();
  });

  test('Load existing medical record after selecting patient', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);

    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectAntecedentsVisible();
    await medicalRecordsPage.expectDownloadPdfVisible();
    await medicalRecordsPage.expectCreateButtonsHidden();
  });

  test('Auto-save changes to general data', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const newConsultationReason = randomString(50);
    await medicalRecordsPage.fillGeneralData('consultation-reason', newConsultationReason);

    await medicalRecordsPage.waitForSaveComplete();
  });

  test('Download PDF for existing record', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    await medicalRecordsPage.expectDownloadPdfVisible();
  });
});
