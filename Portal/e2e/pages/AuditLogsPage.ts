import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { AuditDrawer } from './Drawers/AuditDrawer';

export class AuditLogsPage extends BasePage {
  readonly searchInput: Locator;
  readonly entityFilter: Locator;
  readonly actionFilter: Locator;
  readonly dateFromFilter: Locator;
  readonly refreshButton: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByTestId('audit-search-input');
    this.entityFilter = page.getByTestId('audit-entity-filter');
    this.actionFilter = page.getByTestId('audit-action-filter');
    this.dateFromFilter = page.getByTestId('audit-date-from-filter');
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
    await this.entityFilter.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async selectActionFilter(label: string) {
    await this.actionFilter.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async setDateFilter(value: string) {
    await this.dateFromFilter.click();
    await this.page.getByTitle(value).first().click();
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
