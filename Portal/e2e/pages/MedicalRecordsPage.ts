import { BasePage } from './BasePage';
import { expect, Page } from '@playwright/test';

export class MedicalRecordsPage extends BasePage {
  readonly createIndividualButton = this.page.getByRole('button', { name: /Crear historia clínica individual/ });
  readonly createFamilyButton = this.page.getByRole('button', { name: /Crear historia clínica de familia/ });
  readonly downloadPdfButton = this.page.getByRole('button', { name: /Descargar PDF/ });
  readonly patientInput = this.page.getByPlaceholder(/Seleccionar paciente/);

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
