import { expect, test } from '@playwright/test';
import { Env } from '../../utils/env';

const SLUG = 'e2e-publica';
const PROVIDER_EMAIL = 'e2e-public-provider@example.com';
const MOCK_BREVO_URL = process.env.MOCK_BREVO_URL ?? 'http://localhost:4010';

interface MockEmail { subject: string; textContent: string }

async function inbox(email: string): Promise<MockEmail[]> {
    const res = await fetch(`${MOCK_BREVO_URL}/__test/messages?email=${encodeURIComponent(email)}`);
    return ((await res.json()) as { messages: MockEmail[] }).messages;
}

async function latestCode(email: string): Promise<string> {
    let code = '';
    await expect.poll(async () => {
        const res = await fetch(`${MOCK_BREVO_URL}/__test/latest-code?email=${encodeURIComponent(email)}`);
        if (!res.ok) return '';
        code = ((await res.json()) as { code: string }).code;
        return code;
    }, { message: 'OTP email never reached the mock Brevo server', timeout: 15_000 }).toMatch(/^\d{6}$/);
    return code;
}

test.describe('self-booking on the public page', () => {
    test.beforeEach(async ({ page }) => {
        await page.route(`${new URL(Env.apiBaseUrl).origin}/**`, (route) => {
            const headers = { ...route.request().headers() };
            delete headers[ 'x-vercel-protection-bypass' ];
            delete headers[ 'x-vercel-set-bypass-cookie' ];
            return route.continue({ headers });
        });
    });

    test('pick a time, verify the email, book, and find it in "Mis citas"', async ({ page }, testInfo) => {
        const email = `reserva-${testInfo.project.name}-${Date.now()}@example.com`;
        const providerNoticesBefore = (await inbox(PROVIDER_EMAIL)).length;

        await page.goto(`/book/${SLUG}`);
        await page.getByRole('button', { name: 'Semana siguiente' }).click();
        const days = page.getByRole('group', { name: 'Días de la semana' });
        const day = days.locator('button[aria-pressed="true"]');
        await expect(day).toBeVisible();
        const dayName = await day.getAttribute('aria-label');
        const time = page.getByRole('list', { name: 'Mañana' }).getByRole('button').first();
        const timeText = (await time.textContent())!.trim();
        await time.click();
        await expect(page.getByRole('heading', { name: /Confirma tu cita/ })).toBeVisible();

        await page.getByLabel('Correo electrónico').fill(email);
        const send = page.getByRole('button', { name: 'Enviar código' });
        await expect(send).toBeEnabled({ timeout: 20_000 });
        await send.click();
        await page.getByLabel('Código de 6 dígitos').fill(await latestCode(email));
        await page.getByRole('button', { name: 'Ingresar' }).click();

        await page.getByLabel('Nombre').fill('Paciente');
        await page.getByLabel('Apellidos').fill('E2E');
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Reservar cita' }).click();

        await expect(page.getByRole('heading', { name: 'Tu cita quedó reservada' })).toBeVisible();
        await expect(page.getByRole('article')).toContainText(timeText);

        await expect.poll(async () => (await inbox(email)).map((m) => m.subject))
            .toContain('Cita confirmada con Dra. Ana Pública');
        await expect.poll(async () => (await inbox(PROVIDER_EMAIL)).length).toBeGreaterThan(providerNoticesBefore);
        const notice = (await inbox(PROVIDER_EMAIL)).at(-1)!;
        expect(notice.subject).toBe('Nueva cita reservada en línea');
        expect(notice.textContent).not.toContain('Paciente E2E');

        await page.getByRole('link', { name: 'Ver mis citas' }).click();
        await expect(page).toHaveURL(new RegExp(`/book/${SLUG}/appointments$`));
        await expect(page.getByRole('list', { name: 'Próximas citas' })).toContainText(timeText);

        await page.goto(`/book/${SLUG}`);
        await page.getByRole('button', { name: 'Semana siguiente' }).click();
        await days.getByRole('button', { name: dayName! }).click();
        await expect(page.getByRole('list', { name: 'Mañana' }).getByRole('button', { name: timeText, exact: true })).toHaveCount(0);
    });
});
