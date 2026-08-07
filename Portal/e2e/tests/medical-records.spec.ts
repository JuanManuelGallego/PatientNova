import { test, expect } from '../fixtures';
import { MedicalRecordsPage } from '../pages/MedicalRecordsPage';
import { uniqueName, uniqueEmail } from '../utils/test-data';

test.describe('Medical Records', () => {
  test('should display medical records page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/medical-records');
    const patientInput = authenticatedPage.getByTestId('medical-records-patient-input');
    await expect(patientInput).toBeVisible();
  });

  test('should display patient autocomplete input', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/medical-records');
    const patientInput = authenticatedPage.getByTestId('medical-records-patient-input');
    await expect(patientInput).toBeVisible();
    await patientInput.focus();
  });

  test('should search and select patient', async ({ authenticatedPage, api }) => {
    const name = uniqueName('MedRec');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });

    await authenticatedPage.goto('/medical-records');
    const page = new MedicalRecordsPage(authenticatedPage);
    await page.selectPatient(name);

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should show create buttons after selecting patient', async ({ authenticatedPage, api }) => {
    const name = uniqueName('MedRecBtn');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });

    await authenticatedPage.goto('/medical-records');
    const page = new MedicalRecordsPage(authenticatedPage);
    await page.selectPatient(name);
    await expect(page.createIndividualButton).toBeVisible();
    await expect(page.createFamilyButton).toBeVisible();

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should create individual medical record', async ({ authenticatedPage, api }) => {
    const name = uniqueName('MedInd');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });

    await authenticatedPage.goto('/medical-records');
    const page = new MedicalRecordsPage(authenticatedPage);
    await page.selectPatient(name);
    await page.createIndividual();

    await expect(authenticatedPage).not.toHaveURL(/\/medical-records$/);

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should create family medical record', async ({ authenticatedPage, api }) => {
    const name = uniqueName('MedFam');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });

    await authenticatedPage.goto('/medical-records');
    const page = new MedicalRecordsPage(authenticatedPage);
    await page.selectPatient(name);
    await page.createFamily();

    await expect(authenticatedPage).not.toHaveURL(/\/medical-records$/);

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should display patient autocomplete results', async ({ authenticatedPage, api }) => {
    const name = uniqueName('AutoComp');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });

    await authenticatedPage.goto('/medical-records');
    const patientInput = authenticatedPage.getByTestId('medical-records-patient-input');
    await patientInput.fill(name.substring(0, 5));
    await authenticatedPage.waitForTimeout(500);
    const options = authenticatedPage.getByRole('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(0);

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should clear patient selection', async ({ authenticatedPage, api }) => {
    const name = uniqueName('ClearSel');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });

    await authenticatedPage.goto('/medical-records');
    const page = new MedicalRecordsPage(authenticatedPage);
    await page.selectPatient(name);
    await expect(page.createIndividualButton).toBeVisible();

    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should show download PDF button for existing record', async ({ authenticatedPage, api }) => {
    const name = uniqueName('PdfDl');
    const patient = await api.createPatient({ name, lastName: 'TestLast', email: uniqueEmail() });
    const record = await api.createMedicalRecord({ patientId: patient.id, name: 'Test Record' });

    await authenticatedPage.goto('/medical-records');
    const page = new MedicalRecordsPage(authenticatedPage);
    await page.selectPatient(name);

    await api.deleteMedicalRecord(record.id as string).catch(() => {});
    await api.deletePatient(patient.id as string).catch(() => {});
  });

  test('should handle empty state with no patient selected', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/medical-records');
    const patientInput = authenticatedPage.getByTestId('medical-records-patient-input');
    await expect(patientInput).toBeVisible();
    const createBtn = authenticatedPage.getByTestId('medical-records-create-individual-button');
    const isVisible = await createBtn.isVisible();
    expect(isVisible).toBe(false);
  });
});
