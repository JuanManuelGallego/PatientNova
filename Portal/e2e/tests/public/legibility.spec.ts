import { expect, test } from '@playwright/test';
import { faintText, fillDetails, goToTimes, latestLink, patientEmail, stripVercelBypass, submitDetails } from '../../support/portal';

const SLUG = 'e2e-publica';

// Patients have no theme, but a provider who opened the page in their own browser left a dark one saved.
test.use({ colorScheme: 'dark' });

test('every label reads clearly in a browser with a dark theme saved', async ({ page }, testInfo) => {
    await stripVercelBypass(page);
    await page.addInitScript(() => localStorage.setItem('patientnova-theme', 'dark'));
    // Polled: a sheet fading in or a button changing color is faint only for those few frames.
    const check = (screen: string) => expect.poll(() => faintText(page), { message: screen }).toEqual([]);

    await page.goto(`/book/${SLUG}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { name: '¿Qué necesitas?' })).toBeVisible();

    // Desktop already shows the profile, so only phones open it.
    const openProfile = page.getByRole('button', { name: 'Ver perfil' });
    if (await openProfile.isVisible()) {
        await openProfile.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await check('profile');
        await page.keyboard.press('Escape');
    }
    await check('need, nothing chosen');

    await goToTimes(page, SLUG);
    await check('times, no time chosen');

    // Desktop shows the month beside the times, so only phones open it.
    const openCalendar = page.getByRole('button', { name: 'Ver calendario' });
    if (await openCalendar.isVisible()) {
        await openCalendar.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await check('calendar');
        await page.keyboard.press('Escape');
    }

    await page.getByRole('button', { name: /Primer horario/ }).click();
    await check('times, time chosen');

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Último paso' })).toBeVisible();
    await check('details');

    const submit = page.getByRole('button', { name: 'Reservar cita' });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(page.getByText('Escribe tu nombre.')).toBeVisible();
    await check('details with errors');

    await page.getByRole('group', { name: 'Recibir el enlace de confirmación por' }).getByRole('button', { name: 'WhatsApp' }).click();
    await expect(page.getByLabel('Número de WhatsApp')).toBeVisible();
    await check('details, WhatsApp');

    const email = patientEmail('legible', testInfo);
    await fillDetails(page, email);
    await submitDetails(page, 'Reservar cita');
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
    await check('check your email');

    await page.goto(await latestLink(email));
    await expect(page.getByRole('heading', { name: 'Confirma tu cita' })).toBeVisible();
    await check('confirmation link');

    await page.getByRole('button', { name: 'Confirmar mi cita' }).click();
    await expect(page.getByRole('heading', { name: 'Tu cita está confirmada' })).toBeVisible();
    await check('confirmed');
});
