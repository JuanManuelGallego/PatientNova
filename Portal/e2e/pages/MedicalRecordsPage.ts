import { BasePage } from './BasePage';
import { Locator, Page } from '@playwright/test';

export class MedicalRecordsPage extends BasePage {
  readonly createIndividualButton: Locator;
  readonly createFamilyButton: Locator;
  readonly downloadPdfButton: Locator;
  readonly patientInput: Locator;

  constructor(page: Page) {
    super(page);
    this.createIndividualButton = this.page.getByTestId('medical-records-create-individual-button');
    this.createFamilyButton = this.page.getByTestId('medical-records-create-family-button');
    this.downloadPdfButton = this.page.getByTestId('medical-records-download-pdf-button');
    this.patientInput = this.page.getByTestId('medical-records-patient-input');
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
}
