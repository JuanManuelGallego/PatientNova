import { expect, type Locator, type Page } from '@playwright/test';

export type RequestsTab = 'pending' | 'resolved' | 'expired';

/** The provider's "Solicitudes" inbox (`/requests`) and its drawer. */
export class RequestsPage {
    readonly badge: Locator;
    readonly drawer: Locator;

    constructor(readonly page: Page) {
        this.badge = page.getByTestId('sidebar-requests-badge');
        this.drawer = page.getByTestId('request-drawer');
    }

    async goto(tab: RequestsTab = 'pending') {
        await this.page.goto(`/requests${tab === 'pending' ? '' : `?tab=${tab}`}`);
        await expect(this.page.getByRole('heading', { name: 'Solicitudes', exact: true })).toBeVisible();
    }

    async openTab(tab: RequestsTab) {
        await this.page.getByTestId(`requests-tab-${tab}`).click();
    }

    /** Rows of the current tab for one patient email. */
    rowsFor(email: string): Locator {
        return this.page.getByTestId(/^request-row-/).filter({ hasText: email });
    }

    async open(row: Locator) {
        await row.click();
        await expect(this.drawer).toBeVisible();
    }

    async approve() {
        await this.drawer.getByTestId('request-approve').click();
        await expect(this.drawer.getByTestId('request-done')).toBeVisible();
    }

    async reject() {
        await this.drawer.getByTestId('request-reject').click();
        await this.page.getByRole('alertdialog').getByRole('button', { name: 'Rechazar' }).click();
        await expect(this.drawer.getByTestId('request-done')).toBeVisible();
    }

    async chooseRestore(patientId: string) {
        await this.drawer.getByTestId(`request-choice-restore-${patientId}`).check();
    }

    async close() {
        await this.page.getByTestId('request-drawer-close').click();
        await expect(this.drawer).toBeHidden();
    }
}
