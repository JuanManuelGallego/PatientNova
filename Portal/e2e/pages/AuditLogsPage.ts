import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { AuditDrawer } from './Drawers/AuditDrawer';

export class AuditLogsPage extends BasePage {
  readonly searchInput: Locator;
  readonly dateFromFilter: Locator;
  readonly refreshButton: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByTestId('audit-search-input');
    this.dateFromFilter = page.getByTestId('audit-date-range-filter');
    this.refreshButton = page.getByTestId('audit-refresh-button');
    this.table = page.getByTestId('audit-table');
  }

  async goToAuditLogs() {
    await this.page.goto('/settings?tab=Registro+de+actividad');
  }

  auditRow(id: string): Locator {
    return this.page.getByTestId(`audit-row-${id}`);
  }

  async search(value: string) {
    await this.searchInput.fill(value);
  }

  async selectEntityFilter(label: string) {
    const trigger = this.page.getByTestId('audit-entity-filter-trigger');
    await trigger.click();
    await this.page.getByTestId('audit-entity-filter').getByRole('option', { name: label }).click();
    await trigger.click();
  }

  async selectActionFilter(label: string) {
    const trigger = this.page.getByTestId('audit-action-filter-trigger');
    await trigger.click();
    await this.page.getByTestId('audit-action-filter').getByRole('option', { name: label }).click();
    await trigger.click();
  }

  async setDateRange(from: string, to: string) {
    await this.page.getByTestId('audit-date-range-filter-trigger').click();
    await this.page.getByPlaceholder('Desde').click();
    const clickDay = async (value: string) => {
      const d = value.split('T')[0].split('-')[2];
      await this.page
        .locator('.ant-picker-cell-in-view')
        .filter({ hasText: d })
        .first()
        .click();
    };
    await clickDay(from);
    await clickDay(to);
    await this.page.getByRole('button', { name: 'Aceptar' }).click();
  }

  async refresh() {
    await this.refreshButton.click();
  }

  async goToNextPage() {
    await this.page.getByTestId('audit-pagination-next').click();
  }

  async goToPreviousPage() {
    await this.page.getByTestId('audit-pagination-previous').click();
  }

  async goToPage(page: number) {
    await this.page.getByTestId(`audit-pagination-page-${page}`).click();
  }

  async expectRowVisible(id: string) {
    await expect(this.auditRow(id)).toBeVisible();
  }

  async expectRowNotVisible(id: string) {
    await expect(this.auditRow(id)).not.toBeVisible();
  }

  async expectRowVisibleByDescription(description: string) {
    await expect(this.table.getByRole('row').filter({ hasText: description })).toBeVisible();
  }

  async openRow(id: string) {
    await this.auditRow(id).click();
    const drawer = new AuditDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }

  async openRowByDescription(description: string) {
    const row = this.table.getByRole('row').filter({ hasText: description });
    await row.click();
    const drawer = new AuditDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }
}
