import { expect, test } from '@playwright/test';
import { RequestsPage } from '../../pages/RequestsPage';
import { openProviderPage } from '../../support/provider-context';
import {
    inbox,
    latestLink,
    patientEmail,
    pickSlot,
    requestByEmail,
    slotOffered,
    stripVercelBypass,
    subjects,
} from '../../support/portal';

const SLUG = 'e2e-aprobacion';
const PROVIDER_EMAIL = 'e2e-approval-provider@example.com';
const PROVIDER_NAME = 'Dra. Clara Aprobación';

test.describe('approval mode: the link sends the request, the provider approves and rejects', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'public', 'runs once, in the desktop public project');
        await stripVercelBypass(page);
    });

    test('a request reaches the provider only after the patient confirms', async ({ page, browser }, testInfo) => {
        const email = patientEmail('solicitud', testInfo);
        const providerNoticesBefore = (await inbox(PROVIDER_EMAIL)).length;

        const a = await pickSlot(page, SLUG);
        await expect(page.getByTestId('booking-approval-note')).toBeVisible();
        await requestByEmail(page, email, 'Enviar solicitud');
        await expect(page.getByTestId('booking-pending')).toContainText('Tu solicitud todavía no se ha enviado');
        const linkA = await latestLink(email);
        expect(await subjects(email)).toContain(`Confirma tu solicitud de cita con ${PROVIDER_NAME}`);

        expect(await slotOffered(page, SLUG, a)).toBe(0);
        expect((await inbox(PROVIDER_EMAIL)).length).toBe(providerNoticesBefore);

        await page.goto(linkA);
        await expect(page.getByRole('heading', { name: 'Confirma tu solicitud' })).toBeVisible();
        await page.getByRole('button', { name: 'Confirmar mi cita' }).click();
        await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
        await expect(page.getByTestId('confirmation-requested')).toContainText(a.timeText);

        await expect.poll(async () => (await inbox(PROVIDER_EMAIL)).length).toBeGreaterThan(providerNoticesBefore);
        const notice = (await inbox(PROVIDER_EMAIL)).at(-1)!;
        expect(notice.subject).toBe('Nueva solicitud de cita en línea');
        expect(notice.textContent).not.toContain('Paciente E2E');
        expect(notice.textContent).not.toContain(email);
        expect(await subjects(email)).not.toContain(`Recibimos tu solicitud de cita con ${PROVIDER_NAME}`);

        expect(await slotOffered(page, SLUG, a)).toBe(0);

        const b = await pickSlot(page, SLUG);
        expect(b.timeText).not.toBe(a.timeText);
        await requestByEmail(page, email, 'Enviar solicitud');
        const linkB = await latestLink(email, linkA);
        await page.goto(linkB);
        await page.getByRole('button', { name: 'Confirmar mi cita' }).click();
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
            await expect(requests.rowsFor(email)).toHaveCount(2);
        } finally {
            await provider.context.close();
        }

        await expect.poll(() => subjects(email)).toContain(`Cita confirmada con ${PROVIDER_NAME}`);
        await expect.poll(() => subjects(email)).toContain(`Tu solicitud de cita con ${PROVIDER_NAME} no fue confirmada`);
    });
});
