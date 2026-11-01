import { expect, test, type Page } from '@playwright/test';
import { Env } from '../../utils/env';

const SLUG = 'e2e-publica';
// The mock Brevo server the API sends email to in the self-contained stack (e2e/support/mock-brevo.mjs).
const MOCK_BREVO_URL = process.env.MOCK_BREVO_URL ?? 'http://localhost:4010';

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

async function requestCode(page: Page, email: string) {
    await page.getByLabel('Correo electrónico').fill(email);
    // Cloudflare's test site key solves itself; the submit unlocks once the widget hands over a token.
    const submit = page.getByRole('button', { name: 'Enviar código' });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(page.getByText(/Si el correo es válido, te enviamos un código/)).toBeVisible();
}

test.describe('portal login on "Mis citas"', () => {
    test.beforeEach(async ({ page }) => {
        // The anonymous CORS class refuses the Vercel bypass headers.
        await page.route(`${new URL(Env.apiBaseUrl).origin}/**`, (route) => {
            const headers = { ...route.request().headers() };
            delete headers[ 'x-vercel-protection-bypass' ];
            delete headers[ 'x-vercel-set-bypass-cookie' ];
            return route.continue({ headers });
        });
    });

    // One test on purpose: the OTP request limiter allows 10 per IP per 15 minutes, shared by both
    // public projects and retries.
    test('emailed code logs in, consent, reload keeps the session, logout', async ({ page }, testInfo) => {
        const email = `paciente-${testInfo.project.name}-${Date.now()}@example.com`;
        await page.goto(`/book/${SLUG}`);
        await page.getByRole('link', { name: 'Mis citas' }).click();
        await expect(page).toHaveURL(new RegExp(`/book/${SLUG}/appointments$`));

        await requestCode(page, email);
        const code = await latestCode(email);

        const codeInput = page.getByLabel('Código de 6 dígitos');
        const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
        await codeInput.fill(wrong);
        await page.getByRole('button', { name: 'Ingresar' }).click();
        await expect(page.getByText(/El código no es válido o ya expiró/)).toBeVisible();

        await codeInput.fill(code);
        await page.getByRole('button', { name: 'Ingresar' }).click();

        // Not a patient of this provider yet: the consent card shows (the server can't tell us apart).
        await expect(page.getByRole('heading', { name: 'Antes de continuar' })).toBeVisible();
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Continuar' }).click();
        await expect(page.getByText('Aquí verás tus citas.')).toBeVisible();

        // Reload: the cookie survives and `/session` re-issues the CSRF token, so consent (a CSRF-guarded
        // POST) still works. No patient exists yet, so the server asks for consent again.
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Antes de continuar' })).toBeVisible();
        const consent = page.waitForResponse((res) => res.url().endsWith('/v1/portal/consent'));
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Continuar' }).click();
        expect((await consent).status()).toBe(204);
        await expect(page.getByText(email)).toBeVisible();

        await page.getByRole('button', { name: 'Cerrar sesión' }).click();
        await expect(page.getByLabel('Correo electrónico')).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    });

    test('an unknown provider shows the unavailable page', async ({ page }) => {
        await page.goto('/book/no-existe-este-enlace/appointments');
        await expect(page.getByRole('heading', { name: 'Esta página de reservas no está disponible' })).toBeVisible();
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
});
