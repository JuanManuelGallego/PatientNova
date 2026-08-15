import { test, expect } from '../fixtures';
import { MedicalRecordsPage } from '../pages/MedicalRecordsPage';
import { Routes, HttpMethods } from '../utils/const';
import { createTestPatient, createTestMedicalRecord } from '../utils/helpers';
import { randomString } from '../utils/test-data';
import { readFileSync } from 'fs';

function recordPatchPromise(page: import('@playwright/test').Page, recordId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === HttpMethods.PATCH &&
      response.url().includes(`/v1/medical-records/${recordId}`),
  );
}

test.describe('Medical Records', () => {
  test('Show empty state when no patient selected', async ({ page }) => {
    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await expect(medicalRecordsPage.patientInput).toBeVisible();
    await medicalRecordsPage.expectCreateButtonsHidden();
    await expect(medicalRecordsPage.patientInput).toHaveValue('');
  });

  test('Show create buttons after selecting patient with no record', async ({ page, api, trackedPatients }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectCreateButtonsVisible();
    await medicalRecordsPage.expectEmptyState();
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
        response.url().includes('/v1/medical-records'),
    );

    await medicalRecordsPage.createIndividual();
    const response = await createResponse;
    expect(response.status()).toBe(201);

    const json = await response.json();
    expect(json.data.id).toBeTruthy();
    expect(json.data.patientId).toBe(patient.id);
    expect(json.data.isFamily).toBe(false);

    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectAntecedentsVisible();
    await medicalRecordsPage.expectDownloadPdfVisible();
    await expect(medicalRecordsPage.familySpecificCard).not.toBeVisible();
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
        response.url().includes('/v1/medical-records'),
    );

    await medicalRecordsPage.createFamily();
    const response = await createResponse;
    expect(response.status()).toBe(201);

    const json = await response.json();
    expect(json.data.id).toBeTruthy();
    expect(json.data.patientId).toBe(patient.id);
    expect(json.data.isFamily).toBe(true);

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

  test('General and antecedent fields persist after reload', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const patchPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.fillGeneralData('name', patient.name);
    await medicalRecordsPage.fillGeneralData('national-id', '1029384756');
    await medicalRecordsPage.selectGeneralDataSex('Femenino');
    await medicalRecordsPage.fillGeneralData('birth-place', 'Bogota DC');
    await medicalRecordsPage.fillGeneralData('consultation-reason', 'Informe psicologico');
    await medicalRecordsPage.fillAntecedent('early-development', 'Desarrollo normal');
    await medicalRecordsPage.fillAntecedent('school-and-work', 'Estudiante');
    const response = await patchPromise;

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe(recordId);
    expect(json.data.name).toBe(patient.name);
    expect(json.data.nationalId).toBe('1029384756');
    expect(json.data.sex).toBe('FEMALE');
    expect(json.data.consultationReason).toBe('Informe psicologico');
    expect(json.data.earlyDevelopment).toBe('Desarrollo normal');

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    await medicalRecordsPage.expectGeneralDataField('name', patient.name);
    await medicalRecordsPage.expectGeneralDataField('national-id', '1029384756');
    await medicalRecordsPage.expectGeneralDataField('birth-place', 'Bogota DC');
    await medicalRecordsPage.expectGeneralDataField('consultation-reason', 'Informe psicologico');
    await medicalRecordsPage.expectAntecedentField('early-development', 'Desarrollo normal');
    await medicalRecordsPage.expectAntecedentField('school-and-work', 'Estudiante');

    const persisted = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect(persisted.name).toBe(patient.name);
    expect(persisted.nationalId).toBe('1029384756');
    expect(persisted.earlyDevelopment).toBe('Desarrollo normal');
  });

  test('Family member add and remove persists', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const addPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.addFamilyMember();
    await addPromise;

    const fillPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.fillFamilyMemberName(0, 'Juan Perez');
    await medicalRecordsPage.fillFamilyMemberAge(0, '40');
    await medicalRecordsPage.selectFamilyMemberSex(0, 'Masculino');
    await medicalRecordsPage.selectFamilyMemberRelationship(0, 'Padre');
    await fillPromise;

    let rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    const members = rec.familyMembers as Array<Record<string, unknown>>;
    expect(members.length).toBe(1);
    expect(members[0].name).toBe('Juan Perez');
    expect(members[0].age).toBe('40');
    expect(members[0].sex).toBe('MALE');
    expect(members[0].relationship).toBe('FATHER');

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectFamilyMemberVisible(0);
    await medicalRecordsPage.expectFamilyMemberField(0, 'name', 'Juan Perez');
    await medicalRecordsPage.expectFamilyMemberField(0, 'age', '40');

    const delPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.deleteFamilyMember(0);
    await delPromise;

    rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.familyMembers as unknown[]).length).toBe(0);

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectFamilyMemberNotVisible(0);
  });

  test('Evolution note add and remove persists', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const addPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.addEvolutionNote();
    await addPromise;

    let rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.evolutionNotes as unknown[]).length).toBe(1);

    const fillPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.fillFirstEvolutionNoteText('Paciente evoluciona favorablemente');
    await fillPromise;

    rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.evolutionNotes as Array<Record<string, unknown>>)[0].text).toBe('Paciente evoluciona favorablemente');

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectFirstEvolutionNoteText('Paciente evoluciona favorablemente');

    const delPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.deleteFirstEvolutionNote();
    await delPromise;

    rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.evolutionNotes as unknown[]).length).toBe(0);

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectNoEvolutionNotes();
  });

  test('Family-specific fields and subsystem relations persist', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name, { isFamily: true });
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectFamilySpecificVisible();

    const patchPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.fillFamilySpecific('family-type', 'Familia nuclear');
    await medicalRecordsPage.fillFamilySpecific('resources', 'Apoyo social fuerte');
    await patchPromise;

    const subPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.toggleSubsystem('CONJUGAL', 'FUNCIONAL');
    await subPromise;
    await medicalRecordsPage.expectSubsystemMarked('CONJUGAL', 'FUNCIONAL');

    let rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect(rec.familyType).toBe('Familia nuclear');
    const relations = rec.subsystemRelations as Array<Record<string, unknown>>;
    expect(relations.some((r) => r.subsystem === 'CONJUGAL' && r.status === 'FUNCIONAL')).toBeTruthy();

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectFamilySpecificVisible();
    await medicalRecordsPage.expectFamilySpecificField('family-type', 'Familia nuclear');
    await medicalRecordsPage.expectSubsystemMarked('CONJUGAL', 'FUNCIONAL');
  });

  test('Document lifecycle: upload, rename, replace, download, delete', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const uploadPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.uploadDocument({ name: 'clinical.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test content') });
    await uploadPromise;

    let rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    const docs = rec.documents as Array<Record<string, unknown>>;
    expect(docs.length).toBe(1);
    const docId = docs[0].id as string;

    await medicalRecordsPage.expectDocumentVisible(docId);
    await medicalRecordsPage.expectDocumentName(docId, 'clinical.pdf');

    await page.reload();
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();
    await medicalRecordsPage.expectDocumentVisible(docId);

    const renamePromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.renameDocument(docId, 'renamed.pdf');
    await renamePromise;
    await medicalRecordsPage.expectDocumentName(docId, 'renamed.pdf');

    rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.documents as Array<Record<string, unknown>>)[0].name).toBe('renamed.pdf');

    const downloadPromise = page.waitForEvent('download');
    await medicalRecordsPage.page.getByTestId(`medical-document-download-${docId}`).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('renamed.pdf');
    const dlBuf = readFileSync(await download.path());
    expect(dlBuf.length).toBeGreaterThan(0);

    const replacePromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.replaceDocument(docId, { name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 replaced') });
    await replacePromise;
    await medicalRecordsPage.expectDocumentName(docId, 'replacement.pdf');

    const deletePromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.deleteDocument(docId);
    await deletePromise;
    await medicalRecordsPage.expectDocumentsEmpty();

    rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.documents as unknown[]).length).toBe(0);
  });

  test('Document upload rejects oversized files', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    await medicalRecordsPage.uploadDocument({ name: 'big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(6 * 1024 * 1024) });
    await medicalRecordsPage.expectDocumentError();
    await medicalRecordsPage.expectDocumentsEmpty();

    const rec = (await api.getMedicalRecord(recordId)).data as Record<string, unknown>;
    expect((rec.documents as unknown[]).length).toBe(0);
  });

  test('Download medical-record PDF via real download event', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    const recordId = record.data.id;
    trackedMedicalRecords.track(recordId);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const nationalId = '9988776655';
    const patchPromise = recordPatchPromise(page, recordId);
    await medicalRecordsPage.fillGeneralData('national-id', nationalId);
    await patchPromise;

    const downloadPromise = page.waitForEvent('download');
    await medicalRecordsPage.downloadPdf();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`Historia Clínica — ${nationalId}.pdf`);
    const buf = readFileSync(await download.path());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('Auto-save changes to general data', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    trackedMedicalRecords.track(record.data.id);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    const newConsultationReason = randomString(50);
    const patchPromise = recordPatchPromise(page, record.data.id);
    await medicalRecordsPage.fillGeneralData('consultation-reason', newConsultationReason);
    await patchPromise;
    await medicalRecordsPage.waitForSaveComplete();
  });

  test('Download PDF for existing record', async ({ page, api, trackedPatients, trackedMedicalRecords }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    const record = await createTestMedicalRecord(api, patient.id, patient.name);
    trackedMedicalRecords.track(record.data.id);

    await page.goto(Routes.MEDICAL_RECORDS);

    const medicalRecordsPage = new MedicalRecordsPage(page);
    await medicalRecordsPage.selectPatient(patient.name);
    await medicalRecordsPage.expectRecordFormVisible();

    await medicalRecordsPage.expectDownloadPdfVisible();
  });
});
