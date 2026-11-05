import { expect, test, type Page } from '@playwright/test';
import { latestCode, stripVercelBypass } from '../../support/portal';

const SLUG = 'e2e-publica';

async function requestCode(page: Page, email: string) {
    await page.getByLabel('Correo electrónico').fill(email);
    const submit = page.getByRole('button', { name: 'Enviar código' });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(page.getByText(/Si el correo es válido, te enviamos un código/)).toBeVisible();
}

test.describe('portal login on "Mis citas"', () => {
    test.beforeEach(async ({ page }) => {
        await stripVercelBypass(page);
    });

    test('emailed code logs in, consent, reload keeps the session, logout', async ({ page }, testInfo) => {
        const email = `paciente-${testInfo.project.name}-${Date.now()}@example.com`;
        await page.goto(`/book/${SLUG}`);
        await page.getByRole('link', { name: 'Mis citas' }).click();
        await expect(page).toHaveURL(new RegExp(`/book/${SLUG}/appointments$`));
        // ENABLE_PORTAL_PHONE_LOGIN stays off here, so only email is offered.
        await expect(page.getByRole('group', { name: 'Recibir el código por' })).toHaveCount(0);

        await requestCode(page, email);
        const code = await latestCode(email);

        const codeInput = page.getByLabel('Código de 6 dígitos');
        const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
        await codeInput.fill(wrong);
        await page.getByRole('button', { name: 'Ingresar' }).click();
        await expect(page.getByText(/El código no es válido o ya expiró/)).toBeVisible();

        await codeInput.fill(code);
        await page.getByRole('button', { name: 'Ingresar' }).click();

        await expect(page.getByRole('heading', { name: 'Antes de continuar' })).toBeVisible();
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Continuar' }).click();
        await expect(page.getByText('No tienes citas próximas.')).toBeVisible();

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
