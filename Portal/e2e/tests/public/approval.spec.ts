import { expect, test } from '@playwright/test';
import { RequestsPage } from '../../pages/RequestsPage';
import { openProviderPage } from '../../support/provider-context';
import {
    inbox,
    patientEmail,
    pickSlot,
    slotOffered,
    stripVercelBypass,
    subjects,
    submitDetails,
    verifyEmail,
} from '../../support/portal';

const SLUG = 'e2e-aprobacion';
const PROVIDER_EMAIL = 'e2e-approval-provider@example.com';
const PROVIDER_NAME = 'Dra. Clara Aprobación';

test.describe('approval mode: request, patient cancel, provider approve and reject', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'public', 'runs once, in the desktop public project');
        await stripVercelBypass(page);
    });

    test('a request holds the slot until the provider resolves it', async ({ page, browser }, testInfo) => {
        const email = patientEmail('solicitud', testInfo);
        const providerNoticesBefore = (await inbox(PROVIDER_EMAIL)).length;

        const first = await pickSlot(page, SLUG);
        await verifyEmail(page, email);
        await submitDetails(page, 'Enviar solicitud');
        await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
        await expect(page.getByTestId('request-sent')).toContainText(first.timeText);

        await expect.poll(() => subjects(email)).toContain(`Recibimos tu solicitud de cita con ${PROVIDER_NAME}`);
        await expect.poll(async () => (await inbox(PROVIDER_EMAIL)).length).toBeGreaterThan(providerNoticesBefore);
        const notice = (await inbox(PROVIDER_EMAIL)).at(-1)!;
        expect(notice.subject).toBe('Nueva solicitud de cita en línea');
        expect(notice.textContent).not.toContain('Paciente E2E');
        expect(notice.textContent).not.toContain(email);

        expect(await slotOffered(page, SLUG, first)).toBe(0);

        await page.goto(`/book/${SLUG}/appointments`);
        const pending = page.getByRole('list', { name: 'Solicitudes pendientes' });
        await expect(pending).toContainText(first.timeText);
        await pending.getByRole('button', { name: 'Cancelar solicitud' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, cancelar solicitud' }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Tu solicitud quedó cancelada' })).toBeVisible();
        expect(await slotOffered(page, SLUG, first)).toBe(1);

        const a = await pickSlot(page, SLUG);
        await submitDetails(page, 'Enviar solicitud');
        await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
        const b = await pickSlot(page, SLUG, 1);
        expect(b.timeText).not.toBe(a.timeText);
        await submitDetails(page, 'Enviar solicitud');
        await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();

        const provider = await openProviderPage(browser, PROVIDER_EMAIL);
        try {
            const requests = new RequestsPage(provider.page);
            await requests.goto();
            await expect(requests.badge).toBeVisible();
            await expect(requests.rowsFor(email)).toHaveCount(2);

            await requests.open(requests.rowsFor(email).first());
            await requests.approve();
            await requests.close();
            await expect(requests.rowsFor(email)).toHaveCount(1);

            await requests.open(requests.rowsFor(email).first());
            await requests.reject();
            await requests.close();
            await expect(requests.rowsFor(email)).toHaveCount(0);

            await requests.openTab('resolved');
            await expect(requests.rowsFor(email)).toHaveCount(3);
        } finally {
            await provider.context.close();
        }

        await expect.poll(() => subjects(email)).toContain(`Cita confirmada con ${PROVIDER_NAME}`);
        await expect.poll(() => subjects(email)).toContain(`Tu solicitud de cita con ${PROVIDER_NAME} no fue confirmada`);

        await page.goto(`/book/${SLUG}/appointments`);
        const upcoming = page.getByRole('list', { name: 'Próximas citas' });
        await expect(upcoming.getByRole('article')).toHaveCount(1);
        const approvedText = (await upcoming.getByRole('article').textContent()) ?? '';
        expect([ a.timeText, b.timeText ].filter((t) => approvedText.includes(t))).toHaveLength(1);
        await expect(page.getByRole('list', { name: 'Solicitudes pendientes' })).toHaveCount(0);

        await upcoming.getByRole('article').getByRole('button', { name: 'Cancelar cita' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, cancelar cita' }).click();
        await expect(page.getByRole('status')).toContainText('Tu cita quedó cancelada');
        await expect(page.getByText('No tienes citas próximas.')).toBeVisible();
    });
});
