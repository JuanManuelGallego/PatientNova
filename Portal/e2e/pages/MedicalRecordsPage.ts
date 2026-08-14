import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';

export class MedicalRecordsPage extends BasePage {
  readonly patientInput: Locator;
  readonly createIndividualButton: Locator;
  readonly createFamilyButton: Locator;
  readonly downloadPdfButton: Locator;
  readonly saveStatusIndicator: Locator;
  readonly generalDataCard: Locator;
  readonly familyCompositionCard: Locator;
  readonly antecedentsCard: Locator;
  readonly familySpecificCard: Locator;
  readonly evolutionNotesCard: Locator;
  readonly documentsCard: Locator;
  readonly familyTableAddButton: Locator;
  readonly evolutionNotesAddButton: Locator;
  readonly documentsSection: Locator;

  constructor(page: Page) {
    super(page);
    this.patientInput = this.page.getByTestId('medical-records-patient-input');
    this.createIndividualButton = this.page.getByTestId('medical-records-create-individual-button');
    this.createFamilyButton = this.page.getByTestId('medical-records-create-family-button');
    this.downloadPdfButton = this.page.getByTestId('medical-records-download-pdf-button');
    this.saveStatusIndicator = this.page.getByTestId('save-status-indicator');
    this.generalDataCard = this.page.locator('[data-testid="medical-record-card"]').filter({ hasText: 'Datos Generales' });
    this.familyCompositionCard = this.page.locator('[data-testid="medical-record-card"]').filter({ hasText: 'Composición Familiar' });
    this.antecedentsCard = this.page.locator('[data-testid="medical-record-card"]').filter({ hasText: 'Antecedentes' });
    this.familySpecificCard = this.page.locator('[data-testid="medical-record-card"]').filter({ hasText: 'Aspectos específicos de la familia' });
    this.evolutionNotesCard = this.page.locator('[data-testid="medical-record-card"]').filter({ hasText: 'Notas de Evolución' });
    this.documentsCard = this.page.locator('[data-testid="medical-record-card"]').filter({ hasText: 'Documentos relacionados' });
    this.familyTableAddButton = this.page.getByTestId('family-table-add-button');
    this.evolutionNotesAddButton = this.page.getByTestId('evolution-notes-add-button');
    this.documentsSection = this.page.getByTestId('documents-section-container');
  }

  async selectPatient(name: string) {
    await this.patientInput.fill(name);
    await this.page.getByRole('option', { name: new RegExp(name) }).click();
  }

  async createIndividual() {
    await this.createIndividualButton.click();
  }

  async createFamily() {
    await this.createFamilyButton.click();
  }

  async downloadPdf() {
    await this.downloadPdfButton.click();
  }

  async expectCreateButtonsVisible() {
    await expect(this.createIndividualButton).toBeVisible();
    await expect(this.createFamilyButton).toBeVisible();
  }

  async expectCreateButtonsHidden() {
    await expect(this.createIndividualButton).not.toBeVisible();
    await expect(this.createFamilyButton).not.toBeVisible();
  }

  async expectRecordFormVisible() {
    await expect(this.generalDataCard).toBeVisible();
    await expect(this.familyCompositionCard).toBeVisible();
    await expect(this.evolutionNotesCard).toBeVisible();
    await expect(this.documentsCard).toBeVisible();
  }

  async expectAntecedentsVisible() {
    await expect(this.antecedentsCard).toBeVisible();
  }

  async expectFamilySpecificVisible() {
    await expect(this.familySpecificCard).toBeVisible();
  }

  async expectDownloadPdfVisible() {
    await expect(this.downloadPdfButton).toBeVisible();
  }

  async fillGeneralData(field: string, value: string) {
    const input = this.page.getByTestId(`general-data-${field}-input`);
    await input.fill(value);
  }

  async expectGeneralDataField(field: string, value: string) {
    const input = this.page.getByTestId(`general-data-${field}-input`);
    await expect(input).toHaveValue(value);
  }

  async waitForSaveComplete() {
    await expect(this.saveStatusIndicator).toHaveAttribute('data-status', 'saved');
  }

  async waitForSaveError() {
    await expect(this.saveStatusIndicator).toHaveAttribute('data-status', 'error');
  }

  async addEvolutionNote() {
    await this.evolutionNotesAddButton.click();
  }

  async addFamilyMember() {
    await this.familyTableAddButton.click();
  }

  async expectEmptyState() {
    await expect(this.page.getByText('El paciente no tiene una historia clínica registrada.')).toBeVisible();
  }

  async expectNoEmptyState() {
    await expect(this.page.getByText('El paciente no tiene una historia clínica registrada.')).not.toBeVisible();
  }

  // ── Family members ──────────────────────────────────────────────────────────

  familyMember(index: number): Locator {
    return this.page.getByTestId(`family-member-${index}`);
  }

  async fillFamilyMemberName(index: number, value: string) {
    await this.page.getByTestId(`family-member-name-${index}`).fill(value);
  }

  async fillFamilyMemberAge(index: number, value: string) {
    await this.page.getByTestId(`family-member-age-${index}`).fill(value);
  }

  async selectFamilyMemberSex(index: number, label: string) {
    await this.page.getByTestId(`family-member-sex-${index}`).click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async selectFamilyMemberRelationship(index: number, label: string) {
    await this.page.getByTestId(`family-member-relationship-${index}`).click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async deleteFamilyMember(index: number) {
    await this.page.getByTestId(`family-member-delete-${index}`).click();
  }

  async expectFamilyMemberVisible(index: number) {
    await expect(this.familyMember(index)).toBeVisible();
  }

  async expectFamilyMemberNotVisible(index: number) {
    await expect(this.familyMember(index)).not.toBeVisible();
  }

  // ── Evolution notes ─────────────────────────────────────────────────────────

  evolutionNote(id: string): Locator {
    return this.page.getByTestId(`evolution-note-${id}`);
  }

  async fillEvolutionNoteText(id: string, value: string) {
    await this.page.getByTestId(`evolution-note-text-${id}`).fill(value);
  }

  async deleteEvolutionNote(id: string) {
    await this.page.getByTestId(`evolution-note-delete-${id}`).click();
  }

  async expectEvolutionNoteVisible(id: string) {
    await expect(this.evolutionNote(id)).toBeVisible();
  }

  async expectEvolutionNoteNotVisible(id: string) {
    await expect(this.evolutionNote(id)).not.toBeVisible();
  }

  // The server may reassign note ids, so prefer index-based locators for
  // evolution notes instead of relying on a captured id across reloads.
  async firstEvolutionNoteId(): Promise<string> {
    return this.page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll('[data-testid^="evolution-note-"]'))) {
        const testId = el.getAttribute('data-testid') ?? '';
        const suffix = testId.slice('evolution-note-'.length);
        if (suffix.startsWith('text-') || suffix.startsWith('date-') || suffix.startsWith('delete-')) continue;
        return suffix;
      }
      return '';
    });
  }

  async fillFirstEvolutionNoteText(value: string) {
    await this.page.locator('[data-testid^="evolution-note-text-"]').first().fill(value);
  }

  async expectFirstEvolutionNoteText(value: string) {
    await expect(this.page.locator('[data-testid^="evolution-note-text-"]').first()).toHaveValue(value);
  }

  async deleteFirstEvolutionNote() {
    await this.page.locator('[data-testid^="evolution-note-delete-"]').first().click();
  }

  async expectNoEvolutionNotes() {
    await expect(this.page.locator('[data-testid^="evolution-note-"]')).toHaveCount(0);
  }

  // ── Subsystem relations matrix ──────────────────────────────────────────────

  subsystemCell(subsystem: string, status: string): Locator {
    return this.page.getByTestId(`subsystem-${subsystem}-${status}`);
  }

  async toggleSubsystem(subsystem: string, status: string) {
    await this.subsystemCell(subsystem, status).click();
  }

  async expectSubsystemMarked(subsystem: string, status: string) {
    await expect(this.subsystemCell(subsystem, status).locator('.markFunc, .markDysfunc, [class*="mark"]')).toBeVisible();
  }

  // ── Documents ───────────────────────────────────────────────────────────────

  document(id: string): Locator {
    return this.page.getByTestId(`medical-document-${id}`);
  }

  async uploadDocument(files: string | { name: string; mimeType: string; buffer: Buffer }) {
    await this.page.getByTestId('medical-document-file-input').setInputFiles(files as never);
  }

  async renameDocument(id: string, name: string) {
    await this.page.getByTestId(`medical-document-rename-${id}`).click();
    const input = this.document(id).locator('input.form-input').first();
    await input.fill(name);
    await input.press('Enter');
  }

  async replaceDocument(id: string, files: string | { name: string; mimeType: string; buffer: Buffer }) {
    await this.page.getByTestId(`medical-document-replace-${id}`).click();
    const replaceInput = this.page
      .getByTestId('medical-document-replace-input')
      .or(this.page.locator('input[type="file"]:not([data-testid])'));
    await replaceInput.setInputFiles(files as never);
  }

  async deleteDocument(id: string) {
    await this.page.getByTestId(`medical-document-delete-${id}`).click();
    await this.document(id).getByRole('button', { name: 'Sí' }).click();
  }

  async expectDocumentVisible(id: string) {
    await expect(this.document(id)).toBeVisible();
  }

  async expectDocumentNotVisible(id: string) {
    await expect(this.document(id)).not.toBeVisible();
  }

  async expectDocumentName(id: string, name: string) {
    await expect(this.document(id).getByText(name, { exact: true })).toBeVisible();
  }

  async expectDocumentsEmpty() {
    await expect(this.page.getByText('No hay documentos adjuntos.')).toBeVisible();
  }

  async expectDocumentError() {
    await expect(this.page.getByText(/supera el límite de 5 MB/i)).toBeVisible();
  }

  // ── General data select ─────────────────────────────────────────────────────

  async selectGeneralDataSex(label: string) {
    await this.page.getByTestId('general-data-sex-select').click();
    await this.page.getByRole('option', { name: label }).click();
  }

  // ── Antecedents ─────────────────────────────────────────────────────────────

  async fillAntecedent(field: string, value: string) {
    await this.page.getByTestId(`antecedents-${field}-input`).fill(value);
  }

  async expectAntecedentField(field: string, value: string) {
    await expect(this.page.getByTestId(`antecedents-${field}-input`)).toHaveValue(value);
  }

  // ── Family-specific fields ──────────────────────────────────────────────────

  async fillFamilySpecific(field: string, value: string) {
    await this.page.getByTestId(`family-specific-${field}-input`).fill(value);
  }

  async expectFamilySpecificField(field: string, value: string) {
    await expect(this.page.getByTestId(`family-specific-${field}-input`)).toHaveValue(value);
  }

  // ── Family member field assertions ─────────────────────────────────────────

  async expectFamilyMemberField(index: number, field: string, value: string) {
    await expect(this.page.getByTestId(`family-member-${field}-${index}`)).toHaveValue(value);
  }

  // ── Subsystem relation assertions ───────────────────────────────────────────

  async expectSubsystemNotMarked(subsystem: string, status: string) {
    await expect(
      this.subsystemCell(subsystem, status).locator('.markFunc, .markDysfunc, [class*="mark"]'),
    ).toHaveCount(0);
  }
}
