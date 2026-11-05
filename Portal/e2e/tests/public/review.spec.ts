import { expect, test } from '@playwright/test';
import { RequestsPage } from '../../pages/RequestsPage';
import { openProviderPage } from '../../support/provider-context';
import { createApiClient } from '../../utils/api';
import { patientEmail, pickSlot, stripVercelBypass, subjects, submitDetails, verifyEmail } from '../../support/portal';

const SLUG = 'e2e-publica';
const PROVIDER_EMAIL = 'e2e-public-provider@example.com';
const PROVIDER_NAME = 'Dra. Ana Pública';

test.describe('review routing: a deleted patient books again', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'public', 'runs once, in the desktop public project');
        await stripVercelBypass(page);
    });

    test('the provider restores the patient while approving', async ({ page, browser }, testInfo) => {
        const email = patientEmail('revision', testInfo);
        const provider = await openProviderPage(browser, PROVIDER_EMAIL);
        try {
            const api = createApiClient(provider.page);
            const created = await api.createPatient({
                name: 'Paciente', lastName: 'Revisión', email, reminderChannel: 'EMAIL', status: 'ACTIVE',
            });
            const patientId = created.data.id;
            await api.deletePatient(patientId);

            const slot = await pickSlot(page, SLUG);
            await verifyEmail(page, email);
            await submitDetails(page, 'Reservar cita');
            await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Tu cita quedó reservada' })).toHaveCount(0);

            const requests = new RequestsPage(provider.page);
            await requests.goto();
            const row = requests.rowsFor(email);
            await expect(row).toHaveCount(1);
            await expect(row).toContainText('paciente inactivo o eliminado');
            await requests.open(row);
            await expect(requests.drawer.getByTestId('request-review-reason')).toBeVisible();
            await expect(requests.drawer.getByTestId(`request-candidate-${patientId}`)).toBeVisible();
            await requests.chooseRestore(patientId);
            await requests.approve();
            await requests.close();

            await expect.poll(() => subjects(email)).toContain(`Cita confirmada con ${PROVIDER_NAME}`);

            await page.goto(`/book/${SLUG}/appointments`);
            const upcoming = page.getByRole('list', { name: 'Próximas citas' });
            await expect(upcoming).toContainText(slot.timeText);
            await upcoming.getByRole('article').first().getByRole('button', { name: 'Cancelar cita' }).click();
            await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, cancelar cita' }).click();
            await expect(page.getByRole('status')).toContainText('Tu cita quedó cancelada');
        } finally {
            await provider.context.close();
        }
    });
});
