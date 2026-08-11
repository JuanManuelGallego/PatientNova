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
}
